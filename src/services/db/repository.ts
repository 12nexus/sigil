import type { GenerationJob, Project, ProjectSummary } from "@/types";
import { stageProgress } from "@/workflows/stages";
import { getDb } from "./database";
import { copyProjectAssets, deleteProjectAssets } from "./assetStore";
import { newId, newShareToken } from "@/utils/id";

/**
 * The storage contract.
 *
 * Everything above this line in the application talks to `ProjectRepository`,
 * never to IndexedDB directly. Swapping in Supabase/Postgres later means
 * writing one new class that satisfies this interface — no component changes.
 */
export interface ProjectRepository {
  list(includeArchived?: boolean): Promise<ProjectSummary[]>;
  get(id: string): Promise<Project | undefined>;
  create(project: Project): Promise<Project>;
  save(project: Project): Promise<Project>;
  duplicate(id: string): Promise<Project | undefined>;
  archive(id: string, archived: boolean): Promise<void>;
  remove(id: string): Promise<void>;

  listJobs(projectId: string): Promise<GenerationJob[]>;
  saveJob(job: GenerationJob): Promise<void>;
  removeJob(jobId: string): Promise<void>;
}

function summarise(project: Project): ProjectSummary {
  const live = project.concepts.filter((c) => c.status !== "archived");
  const cover =
    project.concepts.find((c) => c.status === "approved")?.primaryAssetId ??
    project.concepts.find((c) => c.status === "finalist")?.primaryAssetId ??
    project.concepts.find((c) => c.status === "shortlisted")?.primaryAssetId ??
    project.concepts.find((c) => c.primaryAssetId)?.primaryAssetId;

  return {
    id: project.id,
    companyName: project.companyName,
    industry: project.industry,
    status: project.status,
    stage: project.stage,
    conceptCount: live.length,
    finalistCount: project.finalistIds.length,
    directionCount: project.directions.length,
    approvedDirectionCount: project.directions.filter((d) => d.status === "approved").length,
    progress: stageProgress(project),
    isDemo: project.isDemo,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    coverAssetId: cover,
  };
}

class IndexedDbProjectRepository implements ProjectRepository {
  async list(includeArchived = false): Promise<ProjectSummary[]> {
    const db = await getDb();
    const all = await db.getAll("projects");
    return all
      .filter((p) => includeArchived || p.status !== "archived")
      .map(summarise)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Project | undefined> {
    const db = await getDb();
    return db.get("projects", id);
  }

  async create(project: Project): Promise<Project> {
    const db = await getDb();
    await db.put("projects", project);
    return project;
  }

  async save(project: Project): Promise<Project> {
    const next = { ...project, updatedAt: new Date().toISOString() };
    const db = await getDb();
    await db.put("projects", next);
    return next;
  }

  /**
   * Duplication copies the full design history, including artwork, and remaps
   * every asset reference so the two projects never share blobs.
   */
  async duplicate(id: string): Promise<Project | undefined> {
    const source = await this.get(id);
    if (!source) return undefined;

    const newProjectId = newId("proj");
    const assetMap = await copyProjectAssets(id, newProjectId);
    const remap = (assetId?: string) =>
      assetId ? (assetMap.get(assetId) ?? assetId) : assetId;

    const copy: Project = {
      ...structuredClone(source),
      id: newProjectId,
      companyName: `${source.companyName} (copy)`,
      status: "active",
      isDemo: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: undefined,
      clientReview: {
        ...structuredClone(source.clientReview),
        shareToken: newShareToken(),
        published: false,
        publishedAt: undefined,
      },
    };

    copy.concepts = copy.concepts.map((c) => ({
      ...c,
      primaryAssetId: remap(c.primaryAssetId),
      assets: c.assets.map((a) => ({ ...a, assetId: remap(a.assetId)! })),
      typography: {
        ...c.typography,
        reconstructedWordmarkAssetId: remap(c.typography.reconstructedWordmarkAssetId),
      },
    }));

    copy.timeline = [
      ...copy.timeline,
      {
        id: newId("evt"),
        at: new Date().toISOString(),
        kind: "system",
        title: "Project duplicated",
        detail: `Copied from "${source.companyName}" with its full design history.`,
      },
    ];

    const db = await getDb();
    await db.put("projects", copy);
    return copy;
  }

  async archive(id: string, archived: boolean): Promise<void> {
    const project = await this.get(id);
    if (!project) return;
    await this.save({
      ...project,
      status: archived ? "archived" : "active",
      archivedAt: archived ? new Date().toISOString() : undefined,
    });
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await deleteProjectAssets(id);
    const tx = db.transaction("jobs", "readwrite");
    for await (const cursor of tx.store.index("by-project").iterate(id)) {
      await cursor.delete();
    }
    await tx.done;
    await db.delete("projects", id);
  }

  async listJobs(projectId: string): Promise<GenerationJob[]> {
    const db = await getDb();
    const jobs = await db.getAllFromIndex("jobs", "by-project", projectId);
    return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveJob(job: GenerationJob): Promise<void> {
    const db = await getDb();
    await db.put("jobs", { ...job, updatedAt: new Date().toISOString() });
  }

  async removeJob(jobId: string): Promise<void> {
    const db = await getDb();
    await db.delete("jobs", jobId);
  }
}

export const projectRepository: ProjectRepository = new IndexedDbProjectRepository();
export { summarise as summariseProject };
