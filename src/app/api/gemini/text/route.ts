import type { NextRequest } from "next/server";
import { generateText } from "@/services/gemini/transport";
import { errorResponse, keyFromRequest, logError, projectFromRequest } from "../_shared";
import { logGeneration } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

    const result = await generateText(
      {
        model: body.model,
        system: body.system,
        prompt: body.prompt,
        schema: body.schema,
        temperature: body.temperature,
        maxOutputTokens: body.maxOutputTokens,
        thinkingLevel: body.thinkingLevel,
      },
      key,
      req.signal,
    );

    await logGeneration({
      kind: "text",
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
        kind: "text",
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
