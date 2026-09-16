import type { NextRequest } from "next/server";
import { generateVisionText } from "@/services/gemini/transport";
import { errorResponse, keyFromRequest } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Structured output grounded in an image. Used by the design critic and the
 * pre-finalist quality gate so the analysis describes the artwork that was
 * actually generated, not the prompt that requested it.
 */
export async function POST(req: NextRequest) {
  try {
    const key = keyFromRequest(req);
    const body = await req.json();

    if (typeof body?.model !== "string" || typeof body?.prompt !== "string") {
      return Response.json(
        { error: { code: "UNKNOWN", message: "model and prompt are required.", retryable: false } },
        { status: 400 },
      );
    }

    const result = await generateVisionText(
      {
        model: body.model,
        system: body.system,
        prompt: body.prompt,
        schema: body.schema,
        image: body.image,
      },
      key,
      req.signal,
    );

    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
