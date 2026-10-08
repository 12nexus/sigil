"use client";

import { assetUrl } from "@/services/db/assetStore";

/** Display URL for a stored asset. Images are served by SIGIL's own API. */
export function useAssetUrl(assetId?: string): string | null {
  return assetId ? assetUrl(assetId) : null;
}
