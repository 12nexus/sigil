import type { NextRequest } from "next/server";
import { presentationAssetIds } from "@/features/present/presentation";
import { handle, jsonError } from "@/server/http";
import { sharedPresentation } from "@/server/share";
import { getAsset } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: an image the shared presentation shows, and nothing else. */
export function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; assetId: string }> },
) {
  return handle(async () => {
    const { token, assetId } = await params;
    const presentation = await sharedPresentation(token);
    if (!presentation || !presentationAssetIds(presentation).has(assetId)) {
      return jsonError(404, "NOT_FOUND", "Image not found.");
    }
    const asset = await getAsset(assetId);
    if (!asset) return jsonError(404, "NOT_FOUND", "Image not found.");
    return new Response(new Uint8Array(asset.data), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.data.length),
        // Short and private: access ends when the link is unpublished or replaced.
        "Cache-Control": "private, max-age=600",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
