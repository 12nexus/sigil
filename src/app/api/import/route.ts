import type { NextRequest } from "next/server";
import { assertId, assertProject, createProject, existingAssetIds } from "@/server/store";
import { handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bring one project over from a browser's old local storage. Idempotent: an
 * existing project is left exactly as it is, and the reply lists only the
 * images the server does not have yet, so a retried import uploads nothing twice.
 */
export function POST(req: NextRequest) {
  return handle(async () => {
    const { project, assetIds } = await req.json();
    assertProject(project);
    if (!Array.isArray(assetIds)) throw new TypeError("assetIds must be an array.");
    for (const id of assetIds) assertId(id, "asset id");

    const created = await createProject(project);
    const have = new Set(await existingAssetIds(assetIds));
    return Response.json({ created, missingAssetIds: assetIds.filter((id: string) => !have.has(id)) });
  });
}
