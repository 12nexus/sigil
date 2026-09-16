import { getDb, type StoredAsset } from "./database";
import { newId } from "@/utils/id";

/**
 * Binary asset storage.
 *
 * Generated images arrive from Gemini as base64. They are converted to Blobs
 * once, on the way in, and served to the UI as object URLs that are cached and
 * revoked together when a project is closed.
 */

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function saveAsset(
  projectId: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const blob = base64ToBlob(base64, mimeType);
  const asset: StoredAsset = {
    id: newId("asset"),
    projectId,
    blob,
    mimeType,
    bytes: blob.size,
    createdAt: new Date().toISOString(),
  };
  const db = await getDb();
  await db.put("assets", asset);
  return asset.id;
}

export async function saveBlobAsset(
  projectId: string,
  blob: Blob,
): Promise<string> {
  const asset: StoredAsset = {
    id: newId("asset"),
    projectId,
    blob,
    mimeType: blob.type || "image/png",
    bytes: blob.size,
    createdAt: new Date().toISOString(),
  };
  const db = await getDb();
  await db.put("assets", asset);
  return asset.id;
}

export async function getAsset(assetId: string): Promise<StoredAsset | undefined> {
  const db = await getDb();
  return db.get("assets", assetId);
}

export async function getAssetBase64(
  assetId: string,
): Promise<{ data: string; mimeType: string } | null> {
  const asset = await getAsset(assetId);
  if (!asset) return null;
  return { data: await blobToBase64(asset.blob), mimeType: asset.mimeType };
}

export async function deleteProjectAssets(projectId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("assets", "readwrite");
  const index = tx.store.index("by-project");
  for await (const cursor of index.iterate(projectId)) {
    await cursor.delete();
  }
  await tx.done;
}

export async function copyProjectAssets(
  fromProjectId: string,
  toProjectId: string,
): Promise<Map<string, string>> {
  const db = await getDb();
  const assets = await db.getAllFromIndex("assets", "by-project", fromProjectId);
  const mapping = new Map<string, string>();
  const tx = db.transaction("assets", "readwrite");
  for (const asset of assets) {
    const id = newId("asset");
    mapping.set(asset.id, id);
    await tx.store.put({ ...asset, id, projectId: toProjectId });
  }
  await tx.done;
  return mapping;
}

/* ------------------------------------------------------------------ */
/* Object URL cache                                                    */
/* ------------------------------------------------------------------ */

const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export function getCachedUrl(assetId: string): string | undefined {
  return urlCache.get(assetId);
}

export async function resolveAssetUrl(assetId: string): Promise<string | null> {
  const cached = urlCache.get(assetId);
  if (cached) return cached;

  const inFlight = pending.get(assetId);
  if (inFlight) return inFlight;

  const task = (async () => {
    const asset = await getAsset(assetId);
    if (!asset) return null;
    const url = URL.createObjectURL(asset.blob);
    urlCache.set(assetId, url);
    return url;
  })().finally(() => pending.delete(assetId));

  pending.set(assetId, task);
  return task;
}

export function releaseAllUrls(): void {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}
