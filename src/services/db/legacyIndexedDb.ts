import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { GenerationJob, Project } from "@/types";

/**
 * The browser database SIGIL used before storage moved to the server.
 *
 * Nothing writes here any more. It is read once per browser by
 * `importLegacyData()` so projects created before the move are carried over.
 */

export const DB_NAME = "sigil";
export const DB_VERSION = 1;

export interface StoredAsset {
  id: string;
  projectId: string;
  blob: Blob;
  mimeType: string;
  bytes: number;
  createdAt: string;
}

interface SigilDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { "by-updated": string; "by-status": string };
  };
  assets: {
    key: string;
    value: StoredAsset;
    indexes: { "by-project": string };
  };
  jobs: {
    key: string;
    value: GenerationJob;
    indexes: { "by-project": string };
  };
}

let dbPromise: Promise<IDBPDatabase<SigilDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<SigilDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is only available in the browser."));
  }
  if (!dbPromise) {
    dbPromise = openDB<SigilDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("projects")) {
          const store = db.createObjectStore("projects", { keyPath: "id" });
          store.createIndex("by-updated", "updatedAt");
          store.createIndex("by-status", "status");
        }
        if (!db.objectStoreNames.contains("assets")) {
          const store = db.createObjectStore("assets", { keyPath: "id" });
          store.createIndex("by-project", "projectId");
        }
        if (!db.objectStoreNames.contains("jobs")) {
          const store = db.createObjectStore("jobs", { keyPath: "id" });
          store.createIndex("by-project", "projectId");
        }
      },
      blocked() {
        console.warn("[sigil/db] Another tab is holding an older database version open.");
      },
    });
  }
  return dbPromise;
}

/** True if this browser has the old database, without creating it as a side effect. */
export async function hasLegacyDb(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  if (typeof indexedDB.databases !== "function") return true;
  const dbs = await indexedDB.databases();
  return dbs.some((d) => d.name === DB_NAME);
}
