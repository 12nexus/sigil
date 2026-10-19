import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/server/http";
import { sharedPresentation } from "@/server/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: the client-safe presentation behind a share link. */
export function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const presentation = await sharedPresentation(token);
    if (!presentation) return jsonError(404, "NOT_FOUND", "This presentation is not available.");
    return Response.json({ presentation }, { headers: { "Cache-Control": "no-store" } });
  });
}
