import type { NextRequest } from "next/server";
import { generateImage } from "@/services/gemini/transport";
import { errorResponse, keyFromRequest, logError, projectFromRequest } from "../_shared";
import { logGeneration, saveAsset } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Generate an image. When the request names a project, the image is written to
 * the database the moment Gemini returns it, before the browser ever sees it,
 * so no generation is lost to a closed tab or a dropped connection.
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

    const result = await generateImage(
      {
        model: body.model,
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        referenceImages: body.referenceImages,
      },
      key,
      req.signal,
    );

    const projectId = projectFromRequest(req, body);
    let assetId: string | undefined;
    if (projectId) {
      try {
        assetId = await saveAsset({
          projectId,
          data: Buffer.from(result.data, "base64"),
          mimeType: result.mimeType,
          source: "generation",
        });
      } catch (err) {
        console.error(`[sigil/gemini] could not store generated image: ${(err as Error).message}`);
      }
    }
    await logGeneration({
      kind: "image",
      model: body.model,
      projectId,
      ok: true,
      durationMs: Date.now() - started,
      prompt: body.prompt,
      response: result.text,
      assetId,
    });

    return Response.json({ ...result, assetId });
  } catch (err) {
    if (typeof body?.prompt === "string") {
      await logGeneration({
        kind: "image",
        model: body.model,
        projectId: projectFromRequest(req, body),
        ok: false,
        durationMs: Date.now() - started,
        prompt: body.prompt,
        error: logError(err),
      });
    }
    return errorResponse(err);
  }
}
