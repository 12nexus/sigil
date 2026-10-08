import type { NextRequest } from "next/server";
import { assertId, getAsset } from "@/server/store";
import { handle, jsonError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    assertId(id);
    const asset = await getAsset(id);
    if (!asset) return jsonError(404, "NOT_FOUND", "Image not found.");
    return new Response(new Uint8Array(asset.data), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.data.length),
        // Asset ids are never reused, so the bytes behind one never change.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  });
}
