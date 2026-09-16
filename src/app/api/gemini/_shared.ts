import type { NextRequest } from "next/server";
import { GeminiError, redact } from "@/services/gemini/errors";
import { resolveApiKey } from "@/services/gemini/transport";

/** Header used to carry an optional user-supplied key from Settings. */
export const KEY_HEADER = "x-sigil-key";

export function keyFromRequest(req: NextRequest): string {
  const override = req.headers.get(KEY_HEADER);
  return resolveApiKey(override);
}

export function errorResponse(err: unknown): Response {
  const geminiError = GeminiError.from(err);
  const payload = geminiError.toJSON();
  payload.message = redact(payload.message);

  // Log without ever including the key or the full prompt.
  console.error(`[sigil/gemini] ${payload.code}: ${payload.message}`);

  const httpStatus =
    payload.code === "MISSING_KEY" || payload.code === "INVALID_KEY"
      ? 401
      : payload.code === "RATE_LIMIT" || payload.code === "QUOTA"
        ? 429
        : payload.code === "INVALID_MODEL"
          ? 400
          : 502;

  return Response.json({ error: payload }, { status: httpStatus });
}
