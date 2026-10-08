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

/** Header the browser uses to say which project a generation belongs to. */
export const PROJECT_HEADER = "x-sigil-project";

export function projectFromRequest(req: NextRequest, body?: { projectId?: unknown }): string | null {
  const value = (typeof body?.projectId === "string" ? body.projectId : null) ?? req.headers.get(PROJECT_HEADER);
  return value && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : null;
}

/** The error text that goes into the generation log, with anything key-shaped removed. */
export function logError(err: unknown): string {
  return redact(GeminiError.from(err).message);
}
