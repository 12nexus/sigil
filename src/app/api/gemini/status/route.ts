import type { NextRequest } from "next/server";
import { listModels, resolveApiKey } from "@/services/gemini/transport";
import { errorResponse, KEY_HEADER } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Does the server have a key? Never returns the key itself. */
export async function GET() {
  const hasServerKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  return Response.json({ hasServerKey });
}

/** Validate the active key and report which models it can reach. */
export async function POST(req: NextRequest) {
  try {
    const key = resolveApiKey(req.headers.get(KEY_HEADER));
    const models = await listModels(key);
    return Response.json({
      ok: true,
      textModels: models.filter(
        (m) => !/image|tts|embedding|lyria|robotics|transcribe/.test(m),
      ),
      imageModels: models.filter((m) => /image|banana/.test(m)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
