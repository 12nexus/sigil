import type { NextRequest } from "next/server";
import { generateVisionText } from "@/services/gemini/transport";
import { errorResponse, keyFromRequest, logError, projectFromRequest } from "../_shared";
import { logGeneration } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Structured output grounded in an image. Used by the design critic and the
 * pre-finalist quality gate so the analysis describes the artwork that was
 * actually generated, not the prompt that requested it.
 */
export async function POST(req: NextRequest) {
  const started = Date.now();
  let body: any;
  try {
    const key = keyFromRequest(req);
    body = await req.json();

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

    await logGeneration({
      kind: "vision",
      model: body.model,
      projectId: projectFromRequest(req),
      ok: true,
      durationMs: Date.now() - started,
      prompt: body.prompt,
      response: result.text,
    });

    return Response.json(result);
  } catch (err) {
    if (typeof body?.prompt === "string") {
      await logGeneration({
        kind: "vision",
        model: body.model,
        projectId: projectFromRequest(req),
        ok: false,
        durationMs: Date.now() - started,
        prompt: body.prompt,
        error: logError(err),
      });
    }
    return errorResponse(err);
  }
}
