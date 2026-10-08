import type { NextRequest } from "next/server";
import { getSettings, saveSettings } from "@/server/store";
import { handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => Response.json({ settings: await getSettings() }));
}

export function PUT(req: NextRequest) {
  return handle(async () => {
    const { settings } = await req.json();
    if (!settings || typeof settings !== "object") throw new TypeError("settings object required.");
    await saveSettings(settings);
    return new Response(null, { status: 204 });
  });
}
