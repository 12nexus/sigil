import type { NextRequest } from "next/server";
import { assertId, MAX_ASSET_BYTES, saveAsset } from "@/server/store";
import { handle, jsonError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Store an image. The body is the raw image bytes with its own Content-Type;
 * the project (and, when importing, the original asset id) go in the query.
 */
export function POST(req: NextRequest) {
  return handle(async () => {
    const search = req.nextUrl.searchParams;
    const projectId = search.get("projectId");
    const id = search.get("id") ?? undefined;
    assertId(projectId, "project id");
    if (id) assertId(id, "asset id");

    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_ASSET_BYTES) return jsonError(413, "TOO_LARGE", "Image is too large.");

    const data = Buffer.from(await req.arrayBuffer());
    const assetId = await saveAsset({
      projectId,
      id,
      data,
      mimeType: (req.headers.get("content-type") ?? "").split(";")[0].trim(),
      source: search.get("source") === "import" ? "import" : "upload",
      createdAt: search.get("createdAt") ?? undefined,
    });
    return Response.json({ assetId }, { status: 201 });
  });
}
