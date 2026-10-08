import "server-only";
import { Pool, type PoolClient } from "pg";

/**
 * Server-side persistence.
 *
 * Projects, generated artwork, batch jobs, the generation log and the app
 * settings all live in PostgreSQL. The schema is created on first use, under
 * an advisory lock so two server processes starting together cannot race.
 */

const MIGRATIONS: string[] = [
  /* 1 — initial schema */ `
  CREATE TABLE projects (
    id          text PRIMARY KEY,
    data        jsonb NOT NULL,
    summary     jsonb NOT NULL,
    status      text NOT NULL,
    revision    integer NOT NULL DEFAULT 1,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX projects_updated_idx ON projects (updated_at DESC);

  CREATE TABLE assets (
    id          text PRIMARY KEY,
    project_id  text NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    mime_type   text NOT NULL,
    bytes       integer NOT NULL,
    data        bytea NOT NULL,
    source      text NOT NULL DEFAULT 'upload',
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX assets_project_idx ON assets (project_id);

  CREATE TABLE jobs (
    id          text PRIMARY KEY,
    project_id  text NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    data        jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX jobs_project_idx ON jobs (project_id);

  -- Every Gemini call, successful or not. Rows outlive their project
  -- (project_id is not a foreign key) so the history is never lost.
  CREATE TABLE generations (
    id           bigserial PRIMARY KEY,
    at           timestamptz NOT NULL DEFAULT now(),
    kind         text NOT NULL,
    model        text,
    project_id   text,
    ok           boolean NOT NULL,
    duration_ms  integer,
    prompt       text,
    response     text,
    error        text,
    asset_id     text
  );
  CREATE INDEX generations_project_idx ON generations (project_id, at DESC);

  CREATE TABLE settings (
    id          integer PRIMARY KEY CHECK (id = 1),
    data        jsonb NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
  );
  `,
];

const globalForDb = globalThis as unknown as {
  sigilPool?: Pool;
  sigilReady?: Promise<void>;
};

function pool(): Pool {
  if (!globalForDb.sigilPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set.");
    globalForDb.sigilPool = new Pool({ connectionString, max: 10 });
    globalForDb.sigilPool.on("error", (err) => {
      console.error(`[sigil/db] idle client error: ${err.message}`);
    });
  }
  return globalForDb.sigilPool;
}

async function migrate(): Promise<void> {
  const client = await pool().connect();
  try {
    await client.query("SELECT pg_advisory_lock(727001)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const { rows } = await client.query<{ v: number | null }>(
      "SELECT max(version) AS v FROM schema_migrations",
    );
    const current = rows[0]?.v ?? 0;
    for (let i = current; i < MIGRATIONS.length; i++) {
      await client.query("BEGIN");
      try {
        await client.query(MIGRATIONS[i]);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [i + 1]);
        await client.query("COMMIT");
        console.log(`[sigil/db] applied migration ${i + 1}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
    client.release();
  }
}

function ready(): Promise<void> {
  if (!globalForDb.sigilReady) {
    globalForDb.sigilReady = migrate().catch((err) => {
      // Let the next request try again rather than caching the failure.
      globalForDb.sigilReady = undefined;
      throw err;
    });
  }
  return globalForDb.sigilReady;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ready();
  const result = await pool().query<T>(text, params);
  return result.rows;
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  await ready();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
