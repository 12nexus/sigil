import type { NextRequest } from "next/server";
import { assertId, duplicateProject } from "@/server/store";
import { handle, jsonError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    assertId(id);
    const copy = await duplicateProject(id);
    if (!copy) return jsonError(404, "NOT_FOUND", "This project no longer exists.");
    return Response.json(copy, { status: 201 });
  });
}
