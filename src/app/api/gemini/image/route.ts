import type { NextRequest } from "next/server";
import { generateImage } from "@/services/gemini/transport";
import { errorResponse, keyFromRequest } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
