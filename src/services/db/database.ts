import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { GenerationJob, Project } from "@/types";

/**
 * Local-first persistence.
 *
 * Projects and generated artwork live in IndexedDB so the studio survives page
 * refreshes and works offline for everything except generation. Image bytes are
 * stored as Blobs in a separate object store, keyed by asset id, so loading the
 * dashboard never deserialises megabytes of base64.
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

/** Rough storage usage, shown on the Settings page. */
export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
