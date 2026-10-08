import { api } from "./api";

/**
 * Image storage.
 *
 * Artwork lives in SIGIL's database and is served from /api/assets/<id>.
 * Images from Gemini are normally stored by the server as they are generated;
 * the upload helpers here cover everything else (imports and fallbacks).
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

export function assetUrl(assetId: string): string {
  return `/api/assets/${encodeURIComponent(assetId)}`;
}

export async function saveBlobAsset(
  projectId: string,
  blob: Blob,
  options?: { id?: string; source?: "upload" | "import"; createdAt?: string },
): Promise<string> {
  const search = new URLSearchParams({ projectId });
  if (options?.id) search.set("id", options.id);
  if (options?.source) search.set("source", options.source);
  if (options?.createdAt) search.set("createdAt", options.createdAt);
  const { assetId } = await api<{ assetId: string }>(`/api/assets?${search}`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "image/png" },
    body: blob,
  });
  return assetId;
}

export async function saveAsset(
  projectId: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  return saveBlobAsset(projectId, base64ToBlob(base64, mimeType));
}

export async function getAsset(
  assetId: string,
): Promise<{ id: string; blob: Blob; mimeType: string } | undefined> {
  const res = await fetch(assetUrl(assetId));
  if (!res.ok) return undefined;
  const blob = await res.blob();
  return { id: assetId, blob, mimeType: blob.type || res.headers.get("content-type") || "image/png" };
}

export async function getAssetBase64(
  assetId: string,
): Promise<{ data: string; mimeType: string } | null> {
  const asset = await getAsset(assetId);
  if (!asset) return null;
  return { data: await blobToBase64(asset.blob), mimeType: asset.mimeType };
}

/** Display URL for an asset. Served by the API, so there is nothing to resolve. */
export function getCachedUrl(assetId: string): string {
  return assetUrl(assetId);
}

export async function resolveAssetUrl(assetId: string): Promise<string | null> {
  return assetUrl(assetId);
}
