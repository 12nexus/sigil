import { storageStats } from "@/server/store";
import { handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => Response.json(await storageStats()));
}
