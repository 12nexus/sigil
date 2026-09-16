import { GeminiError } from "./errors";

/**
 * Browser-side transport. Talks only to SIGIL's own API routes — never
 * directly to Google — so the API key never enters client bundles or network
 * requests originating from the page.
 */

const KEY_HEADER = "x-sigil-key";

/** Read the optional user key from Settings, if the user opted into one. */
function keyOverride(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("sigil.settings");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.useServerKey === false && typeof parsed?.apiKeyOverride === "string") {
      return parsed.apiKeyOverride.trim() || null;
    }
  } catch {
    /* ignore malformed settings */
  }
  return null;
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const override = keyOverride();
  if (override) headers[KEY_HEADER] = override;

  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw GeminiError.from(err);
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const shape = (payload as any)?.error;
    if (shape?.code) throw new GeminiError(shape);
    throw new GeminiError({
      code: "UNKNOWN",
      message: `Request failed with status ${res.status}.`,
      retryable: res.status >= 500,
      status: res.status,
    });
  }
  return payload as T;
}

export interface RawTextResult {
  text: string;
  model: string;
}

export interface RawImageResult {
  mimeType: string;
  data: string;
  model: string;
  text?: string;
}

export function requestText(
  body: {
    model: string;
    system?: string;
    prompt: string;
    schema?: Record<string, unknown>;
    temperature?: number;
    maxOutputTokens?: number;
    thinkingLevel?: "low" | "medium" | "high";
  },
  signal?: AbortSignal,
): Promise<RawTextResult> {
  return post<RawTextResult>("/api/gemini/text", body, signal);
}

export function requestImage(
  body: {
    model: string;
    prompt: string;
    aspectRatio?: string;
    referenceImages?: Array<{ mimeType: string; data: string }>;
  },
  signal?: AbortSignal,
): Promise<RawImageResult> {
  return post<RawImageResult>("/api/gemini/image", body, signal);
}

export async function checkServerKey(): Promise<boolean> {
  try {
    const res = await fetch("/api/gemini/status");
    const data = await res.json();
    return Boolean(data?.hasServerKey);
  } catch {
    return false;
  }
}

export async function validateKey(): Promise<{
  ok: boolean;
  textModels: string[];
  imageModels: string[];
}> {
  return post("/api/gemini/status", {});
}
