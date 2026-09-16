"use client";

import { useEffect, useState } from "react";
import { getCachedUrl, resolveAssetUrl } from "@/services/db/assetStore";

/**
 * Resolve an IndexedDB asset id to a displayable object URL.
 *
 * Cache hits are read during render rather than pushed through state, so a
 * concept grid of already-loaded artwork renders in one pass instead of
 * cascading a re-render per tile.
 */
export function useAssetUrl(assetId?: string): string | null {
  const cached = assetId ? (getCachedUrl(assetId) ?? null) : null;
  const [resolved, setResolved] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!assetId || cached) return;
    let active = true;
    void resolveAssetUrl(assetId).then((url) => {
      if (active) setResolved((prev) => ({ ...prev, [assetId]: url }));
    });
    return () => {
      active = false;
    };
  }, [assetId, cached]);

  if (!assetId) return null;
  return cached ?? resolved[assetId] ?? null;
}
