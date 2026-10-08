import type { NextRequest } from "next/server";
import { assertId, assertProject, deleteProject, getProject, saveProject } from "@/server/store";
import { handle, jsonError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    assertId(id);
    const stored = await getProject(id);
    if (!stored) return jsonError(404, "NOT_FOUND", "This project no longer exists.");
    return Response.json(stored);
  });
}

export function PUT(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const { project, revision } = await req.json();
    assertProject(project);
    if (project.id !== id) throw new TypeError("Project id does not match the URL.");
    if (revision != null && !Number.isInteger(revision)) throw new TypeError("Invalid revision.");
    return Response.json(await saveProject(project, revision ?? undefined));
  });
}

export function DELETE(_req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    assertId(id);
    await deleteProject(id);
    return new Response(null, { status: 204 });
  });
}
