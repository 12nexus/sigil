import type { Project } from "@/types";
import { api, json } from "./api";
import { saveBlobAsset } from "./assetStore";
import { getDb, hasLegacyDb } from "./legacyIndexedDb";
import { projectRepository } from "./repository";

/**
 * One-time move of projects from this browser's old IndexedDB store to the
 * server. Safe to run any number of times: projects the server already has are
 * left untouched, and only images it is missing are uploaded. The browser copy
 * is never deleted.
 */

const DONE_KEY = "sigil.legacyImportDone";

export interface ImportResult {
  projects: number;
  assets: number;
  failed: number;
}

export async function importLegacyData(): Promise<ImportResult | null> {
  try {
    if (window.localStorage.getItem(DONE_KEY)) return null;
  } catch {
    /* no localStorage: fall through, the import is idempotent */
  }
  if (!(await hasLegacyDb())) {
    markDone();
    return null;
  }

  const db = await getDb();
  const projects = await db.getAll("projects");
  const result: ImportResult = { projects: 0, assets: 0, failed: 0 };

  for (const project of projects) {
    try {
      const assetIds = (await db.getAllKeysFromIndex("assets", "by-project", project.id)) as string[];
      const { created, missingAssetIds } = await api<{ created: boolean; missingAssetIds: string[] }>(
        "/api/import",
        { method: "POST", body: json({ project: project as Project, assetIds }) },
      );
      for (const id of missingAssetIds) {
        const asset = await db.get("assets", id);
        if (!asset) continue;
        await saveBlobAsset(project.id, asset.blob, {
          id,
          source: "import",
          createdAt: asset.createdAt,
        });
        result.assets += 1;
      }
      if (created) {
        for (const job of await db.getAllFromIndex("jobs", "by-project", project.id)) {
          await projectRepository.saveJob(job);
        }
        result.projects += 1;
      }
    } catch (err) {
      console.error(`[sigil] could not import project ${project.id}`, err);
      result.failed += 1;
    }
  }

  if (result.failed === 0) markDone();
  return result;
}

function markDone(): void {
  try {
    window.localStorage.setItem(DONE_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}
