import type { GeminiErrorCode, GeminiErrorShape } from "@/types";

/**
 * A single error type used on both sides of the API boundary so the UI can
 * render an understandable message and decide whether to offer "Retry".
 */
export class GeminiError extends Error {
  readonly code: GeminiErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(shape: GeminiErrorShape) {
    super(shape.message);
    this.name = "GeminiError";
    this.code = shape.code;
    this.retryable = shape.retryable;
    this.status = shape.status;
    this.retryAfterMs = shape.retryAfterMs;
  }

  toJSON(): GeminiErrorShape {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      status: this.status,
      retryAfterMs: this.retryAfterMs,
    };
  }

  static from(value: unknown): GeminiError {
    if (value instanceof GeminiError) return value;
    if (value instanceof DOMException && value.name === "AbortError") {
      return new GeminiError({
        code: "CANCELLED",
        message: "The request was cancelled.",
        retryable: true,
      });
    }
    const message = value instanceof Error ? value.message : String(value);
    if (/fetch failed|network|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(message)) {
      return new GeminiError({
        code: "NETWORK",
        message:
          "Could not reach the Gemini API. Check your internet connection and try again.",
        retryable: true,
      });
    }
    return new GeminiError({ code: "UNKNOWN", message, retryable: true });
  }
}

/** Human-readable guidance shown alongside the raw message. */
export const ERROR_GUIDANCE: Record<GeminiErrorCode, string> = {
  MISSING_KEY:
    "No Gemini API key is configured. Add GEMINI_API_KEY to .env.local, or paste a key in Settings.",
  INVALID_KEY:
    "The Gemini API key was rejected. Verify it in Google AI Studio and update it in Settings.",
  RATE_LIMIT:
    "Gemini is rate limiting this key. SIGIL will back off automatically — lower the batch concurrency in Settings if this keeps happening.",
  QUOTA:
    "The API quota for this key is exhausted. Check your Google AI Studio quota or billing.",
  TIMEOUT:
    "The request took too long. Image generation is slow under load — retry the failed items.",
  NETWORK: "Network problem reaching Gemini. Check your connection and retry.",
  INVALID_MODEL:
    "The configured model name is not available to this key. Pick a different model in Settings.",
  SAFETY_BLOCK:
    "Gemini blocked this request under its safety filters. Rewording the brief or the feedback usually resolves it.",
  NO_IMAGE:
    "Gemini responded but returned no image. This is usually transient — retry the item.",
  INVALID_OUTPUT:
    "Gemini returned output that did not match the expected structure. Retrying usually fixes it.",
  SERVER_ERROR: "Gemini returned a server error. This is usually transient.",
  CANCELLED: "Cancelled.",
  UNKNOWN: "Something went wrong. The details above come from the Gemini API.",
};

/** Map a raw Google API error response onto our taxonomy. */
export function classifyApiError(
  status: number,
  body: unknown,
): GeminiError {
  const raw =
    (body as any)?.error?.message ??
    (typeof body === "string" ? body : "Unknown Gemini API error");
  const message = redact(String(raw));

  if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(message)) {
    return new GeminiError({ code: "INVALID_KEY", message, retryable: false, status });
  }
  if (status === 400 && /not found|not supported|invalid model/i.test(message)) {
    return new GeminiError({ code: "INVALID_MODEL", message, retryable: false, status });
  }
  if (status === 401 || status === 403) {
    return new GeminiError({ code: "INVALID_KEY", message, retryable: false, status });
  }
  if (status === 404) {
    return new GeminiError({
      code: "INVALID_MODEL",
      message: `${message} (model not found)`,
      retryable: false,
      status,
    });
  }
  if (status === 429) {
    const retryAfter = extractRetryDelay(body);
    return new GeminiError({
      code: /quota/i.test(message) ? "QUOTA" : "RATE_LIMIT",
      message,
      retryable: true,
      status,
      retryAfterMs: retryAfter,
    });
  }
  if (status >= 500) {
    return new GeminiError({ code: "SERVER_ERROR", message, retryable: true, status });
  }
  return new GeminiError({ code: "UNKNOWN", message, retryable: status !== 400, status });
}

function extractRetryDelay(body: unknown): number | undefined {
  const details = (body as any)?.error?.details;
  if (!Array.isArray(details)) return undefined;
  for (const d of details) {
    if (typeof d?.retryDelay === "string") {
      const seconds = parseFloat(d.retryDelay.replace("s", ""));
      if (!Number.isNaN(seconds)) return Math.ceil(seconds * 1000);
    }
  }
  return undefined;
}

/**
 * Defence in depth: strip anything that looks like a key before an error
 * message can reach a log or the browser.
 */
export function redact(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_\-]{20,}/g, "[redacted-key]")
    .replace(/AQ\.[0-9A-Za-z_\-]{20,}/g, "[redacted-key]")
    .replace(/(key=)[^&\s"']+/gi, "$1[redacted]");
}
