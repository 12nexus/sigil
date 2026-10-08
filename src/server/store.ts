import "server-only";
import type { AppSettings, GenerationJob, Project, ProjectSummary } from "@/types";
import { buildDuplicate, summariseProject } from "@/services/db/projectData";
import { newId } from "@/utils/id";
import { query, transaction } from "./db";

/**
 * The server-side store behind SIGIL's /api routes. Projects are kept whole as
 * JSON (the domain model is one nested document), with a precomputed summary
 * for the dashboard and a revision number for optimistic concurrency.
 */

export class ConflictError extends Error {
  constructor(message = "This project was changed in another tab or by someone else.") {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export function assertId(id: unknown, what = "id"): asserts id is string {
  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    throw new TypeError(`Invalid ${what}.`);
  }
}

export function assertProject(value: unknown): asserts value is Project {
  const p = value as Project | null;
  if (!p || typeof p !== "object") throw new TypeError("A project object is required.");
  assertId(p.id, "project id");
  if (typeof p.companyName !== "string" || !Array.isArray(p.concepts)) {
    throw new TypeError("That does not look like a SIGIL project.");
  }
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export interface StoredProject {
  project: Project;
  revision: number;
}

export async function listProjects(includeArchived: boolean): Promise<ProjectSummary[]> {
  const rows = await query<{ summary: ProjectSummary }>(
    `SELECT summary FROM projects
      WHERE $1::boolean OR status <> 'archived'
      ORDER BY updated_at DESC`,
    [includeArchived],
  );
  return rows.map((r) => r.summary);
}

export async function getProject(id: string): Promise<StoredProject | null> {
  const rows = await query<{ data: Project; revision: number }>(
    "SELECT data, revision FROM projects WHERE id = $1",
    [id],
  );
  return rows[0] ? { project: rows[0].data, revision: rows[0].revision } : null;
}

/** Insert a new project. Returns false if the id already exists. */
export async function createProject(project: Project): Promise<boolean> {
  const rows = await query(
    `INSERT INTO projects (id, data, summary, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      project.id,
      project,
      summariseProject(project),
      project.status,
      project.createdAt ?? new Date().toISOString(),
      project.updatedAt ?? new Date().toISOString(),
    ],
  );
  return rows.length > 0;
}

/**
 * Save a project. With `expectedRevision`, the write only lands if nobody else
 * has saved since that revision was read; otherwise a ConflictError is thrown
 * instead of silently overwriting their work.
 */
export async function saveProject(
  input: Project,
  expectedRevision?: number,
): Promise<StoredProject> {
  const project: Project = { ...input, updatedAt: new Date().toISOString() };
  const rows = await query<{ revision: number }>(
    `UPDATE projects
        SET data = $2, summary = $3, status = $4, updated_at = $5, revision = revision + 1
      WHERE id = $1 AND ($6::integer IS NULL OR revision = $6)
      RETURNING revision`,
    [
      project.id,
      project,
      summariseProject(project),
      project.status,
      project.updatedAt,
      expectedRevision ?? null,
    ],
  );
  if (rows[0]) return { project, revision: rows[0].revision };

  const exists = await query("SELECT 1 FROM projects WHERE id = $1", [project.id]);
  if (exists.length > 0) throw new ConflictError();
  await createProject(project);
  return { project, revision: 1 };
}

export async function duplicateProject(id: string): Promise<StoredProject | null> {
  return transaction(async (client) => {
    const { rows } = await client.query<{ data: Project }>(
      "SELECT data FROM projects WHERE id = $1",
      [id],
    );
    if (!rows[0]) return null;
    const source = rows[0].data;

    const newProjectId = newId("proj");
    const assets = await client.query<{ id: string }>(
      "SELECT id FROM assets WHERE project_id = $1",
      [id],
    );
    const assetMap = new Map<string, string>();
    for (const a of assets.rows) assetMap.set(a.id, newId("asset"));

    const copy = buildDuplicate(source, newProjectId, assetMap);
    await client.query(
      `INSERT INTO projects (id, data, summary, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [copy.id, copy, summariseProject(copy), copy.status, copy.createdAt, copy.updatedAt],
    );
    if (assetMap.size > 0) {
      await client.query(
        `INSERT INTO assets (id, project_id, mime_type, bytes, data, source, created_at)
         SELECT m.new_id, $1, a.mime_type, a.bytes, a.data, a.source, a.created_at
           FROM assets a
           JOIN unnest($2::text[], $3::text[]) AS m(old_id, new_id) ON m.old_id = a.id`,
        [newProjectId, [...assetMap.keys()], [...assetMap.values()]],
      );
    }
    return { project: copy, revision: 1 };
  });
}

export async function deleteProject(id: string): Promise<void> {
  // Assets and jobs go with it (ON DELETE CASCADE). The generation log stays.
  await query("DELETE FROM projects WHERE id = $1", [id]);
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                */
/* ------------------------------------------------------------------ */

export async function listJobs(projectId: string): Promise<GenerationJob[]> {
  const rows = await query<{ data: GenerationJob }>(
    "SELECT data FROM jobs WHERE project_id = $1 ORDER BY created_at DESC",
    [projectId],
  );
  return rows.map((r) => r.data);
}

export async function saveJob(job: GenerationJob): Promise<void> {
  const next = { ...job, updatedAt: new Date().toISOString() };
  const rows = await query(
    `INSERT INTO jobs (id, project_id, data, created_at, updated_at)
     SELECT $1, $2, $3, $4, $5 WHERE EXISTS (SELECT 1 FROM projects WHERE id = $2)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
     RETURNING id`,
    [next.id, next.projectId, next, next.createdAt ?? next.updatedAt, next.updatedAt],
  );
  if (rows.length === 0) throw new NotFoundError("The project for this job no longer exists.");
}

export async function deleteJob(id: string): Promise<void> {
  await query("DELETE FROM jobs WHERE id = $1", [id]);
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export const MAX_ASSET_BYTES = 20 * 1024 * 1024;

export async function saveAsset(input: {
  projectId: string;
  data: Buffer;
  mimeType: string;
  source: "generation" | "upload" | "import";
  id?: string;
  createdAt?: string;
}): Promise<string> {
  if (!/^image\/[a-z0-9.+-]+$/i.test(input.mimeType)) throw new TypeError("Only images can be stored.");
  if (input.data.length === 0 || input.data.length > MAX_ASSET_BYTES) {
    throw new TypeError("Image is empty or too large.");
  }
  const id = input.id ?? newId("asset");
  const rows = await query(
    `INSERT INTO assets (id, project_id, mime_type, bytes, data, source, created_at)
     SELECT $1, $2, $3, $4, $5, $6, $7 WHERE EXISTS (SELECT 1 FROM projects WHERE id = $2)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      id,
      input.projectId,
      input.mimeType,
      input.data.length,
      input.data,
      input.source,
      input.createdAt ?? new Date().toISOString(),
    ],
  );
  if (rows.length === 0) {
    const exists = await query("SELECT 1 FROM assets WHERE id = $1", [id]);
    if (exists.length === 0) throw new NotFoundError("The project for this image no longer exists.");
  }
  return id;
}

export async function getAsset(
  id: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  const rows = await query<{ data: Buffer; mime_type: string }>(
    "SELECT data, mime_type FROM assets WHERE id = $1",
    [id],
  );
  return rows[0] ? { data: rows[0].data, mimeType: rows[0].mime_type } : null;
}

export async function existingAssetIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await query<{ id: string }>("SELECT id FROM assets WHERE id = ANY($1::text[])", [ids]);
  return rows.map((r) => r.id);
}

/* ------------------------------------------------------------------ */
/* Generation log                                                      */
/* ------------------------------------------------------------------ */

const LOG_TEXT_LIMIT = 200_000;
const clip = (s?: string | null) => (s == null ? null : s.slice(0, LOG_TEXT_LIMIT));

/** Record one Gemini call. Never throws: logging must not break generation. */
export async function logGeneration(entry: {
  kind: "text" | "image" | "vision";
  model?: string;
  projectId?: string | null;
  ok: boolean;
  durationMs?: number;
  prompt?: string;
  response?: string;
  error?: string;
  assetId?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO generations (kind, model, project_id, ok, duration_ms, prompt, response, error, asset_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.kind,
        entry.model ?? null,
        entry.projectId ?? null,
        entry.ok,
        entry.durationMs != null ? Math.round(entry.durationMs) : null,
        clip(entry.prompt),
        clip(entry.response),
        clip(entry.error),
        entry.assetId ?? null,
      ],
    );
  } catch (err) {
    console.error(`[sigil/db] could not log generation: ${(err as Error).message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Settings and storage                                                */
/* ------------------------------------------------------------------ */

/** Settings shared by everyone. The personal API key never reaches the server. */
export type SharedSettings = Omit<AppSettings, "apiKeyOverride" | "useServerKey">;

export async function getSettings(): Promise<Partial<SharedSettings> | null> {
  const rows = await query<{ data: Partial<SharedSettings> }>("SELECT data FROM settings WHERE id = 1");
  return rows[0]?.data ?? null;
}

export async function saveSettings(settings: Partial<SharedSettings>): Promise<void> {
  const clean = { ...settings } as Record<string, unknown>;
  delete clean.apiKeyOverride;
  delete clean.useServerKey;
  await query(
    `INSERT INTO settings (id, data, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [clean],
  );
}

export async function storageStats(): Promise<{
  projects: number;
  assets: number;
  assetBytes: number;
  generations: number;
  databaseBytes: number;
}> {
  const rows = await query<{
    projects: string;
    assets: string;
    asset_bytes: string;
    generations: string;
    database_bytes: string;
  }>(
    `SELECT (SELECT count(*) FROM projects) AS projects,
            (SELECT count(*) FROM assets) AS assets,
            (SELECT coalesce(sum(bytes), 0) FROM assets) AS asset_bytes,
            (SELECT count(*) FROM generations) AS generations,
            pg_database_size(current_database()) AS database_bytes`,
  );
  const r = rows[0];
  return {
    projects: Number(r.projects),
    assets: Number(r.assets),
    assetBytes: Number(r.asset_bytes),
    generations: Number(r.generations),
    databaseBytes: Number(r.database_bytes),
  };
}
