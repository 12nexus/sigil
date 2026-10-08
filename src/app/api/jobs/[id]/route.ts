import type { NextRequest } from "next/server";
import { assertId, deleteJob, saveJob } from "@/server/store";
import { handle } from "@/server/http";
import type { GenerationJob } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function PUT(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const { job } = (await req.json()) as { job: GenerationJob };
    assertId(id);
    if (!job || job.id !== id) throw new TypeError("Job id does not match the URL.");
    assertId(job.projectId, "project id");
    await saveJob(job);
    return new Response(null, { status: 204 });
  });
}

export function DELETE(_req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    assertId(id);
    await deleteJob(id);
    return new Response(null, { status: 204 });
  });
}
