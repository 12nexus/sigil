import type { NextRequest } from "next/server";
import { assertProject, createProject, listProjects } from "@/server/store";
import { handle, jsonError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return handle(async () => {
    const includeArchived = req.nextUrl.searchParams.get("archived") === "1";
    return Response.json({ projects: await listProjects(includeArchived) });
  });
}

export function POST(req: NextRequest) {
  return handle(async () => {
    const { project } = await req.json();
    assertProject(project);
    if (!(await createProject(project))) {
      return jsonError(409, "EXISTS", "A project with this id already exists.");
    }
    return Response.json({ project, revision: 1 }, { status: 201 });
  });
}
