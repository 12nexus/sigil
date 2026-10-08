import type { NextRequest } from "next/server";
import { assertId, listJobs } from "@/server/store";
import { handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    assertId(id);
    return Response.json({ jobs: await listJobs(id) });
  });
}
