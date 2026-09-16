import "server-only";
import { GEMINI_API_BASE, REQUEST_TIMEOUT_MS } from "./config";
import { GeminiError, classifyApiError, redact } from "./errors";

/**
 * Server-side Gemini transport.
 *
 * This is the ONLY place in the application that sees an API key or talks to
 * generativelanguage.googleapis.com. Browser code reaches it through the
 * /api/gemini/* route handlers.
 */

export interface TextRequest {
  model: string;
  system?: string;
  prompt: string;
  /** Google `responseSchema` (OpenAPI subset) for structured output. */
  schema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  thinkingLevel?: "low" | "medium" | "high";
}

export interface ImageRequest {
  model: string;
  prompt: string;
  aspectRatio?: string;
  /** Reference images (base64, no data: prefix) for iteration/consistency. */
  referenceImages?: Array<{ mimeType: string; data: string }>;
}

export interface ImageResult {
  mimeType: string;
  /** Base64, no data: prefix. */
  data: string;
  model: string;
  /** Any commentary the model returned alongside the image. */
  text?: string;
}

/** Resolve the key: request-supplied override first, then server env. */
export function resolveApiKey(override?: string | null): string {
  const key = (override || process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    throw new GeminiError({
      code: "MISSING_KEY",
      message: "No Gemini API key configured.",
      retryable: false,
    });
  }
  return key;
}

async function callGemini(
  model: string,
  apiKey: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<any> {
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
    throw new GeminiError({
      code: "INVALID_MODEL",
      message: `"${model}" is not a valid model name.`,
      retryable: false,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(
      `${GEMINI_API_BASE}/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Key travels in a header, never in the URL, so it cannot leak
          // into proxy logs or error strings that echo the request URL.
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = text;
    }

    if (!res.ok) throw classifyApiError(res.status, parsed);
    return parsed;
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    if ((err as Error)?.name === "AbortError") {
      throw new GeminiError({
        code: signal?.aborted ? "CANCELLED" : "TIMEOUT",
        message: signal?.aborted
          ? "Request cancelled."
          : `Gemini did not respond within ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s.`,
        retryable: true,
      });
    }
    throw GeminiError.from(err);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function collectText(response: any): string {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p: any) => typeof p?.text === "string")
    .map((p: any) => p.text)
    .join("");
}

function checkBlocked(response: any): void {
  const feedback = response?.promptFeedback;
  if (feedback?.blockReason) {
    throw new GeminiError({
      code: "SAFETY_BLOCK",
      message: `Gemini blocked the request (${feedback.blockReason}).`,
      retryable: false,
    });
  }
  const finish = response?.candidates?.[0]?.finishReason;
  if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") {
    throw new GeminiError({
      code: "SAFETY_BLOCK",
      message: "Gemini stopped generation under its safety filters.",
      retryable: false,
    });
  }
}

export async function generateText(
  req: TextRequest,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ text: string; model: string }> {
  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature ?? 1,
  };
  if (req.maxOutputTokens) generationConfig.maxOutputTokens = req.maxOutputTokens;
  if (req.schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = req.schema;
  }
  if (req.thinkingLevel) {
    generationConfig.thinkingConfig = { thinkingLevel: req.thinkingLevel };
  }

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: req.prompt }] }],
    generationConfig,
  };
  if (req.system) {
    body.systemInstruction = { parts: [{ text: req.system }] };
  }

  const response = await callGemini(req.model, apiKey, body, signal);
  checkBlocked(response);

  const text = collectText(response);
  if (!text.trim()) {
    const finish = response?.candidates?.[0]?.finishReason;
    throw new GeminiError({
      code: finish === "MAX_TOKENS" ? "INVALID_OUTPUT" : "INVALID_OUTPUT",
      message:
        finish === "MAX_TOKENS"
          ? "Gemini hit the output token limit before finishing. Try again."
          : "Gemini returned an empty response.",
      retryable: true,
    });
  }
  return { text, model: req.model };
}

export async function generateImage(
  req: ImageRequest,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ImageResult> {
  const parts: any[] = [];
  for (const ref of req.referenceImages ?? []) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
  }
  parts.push({ text: req.prompt });

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: req.aspectRatio ?? "1:1" },
    },
  };

  const response = await callGemini(req.model, apiKey, body, signal);
  checkBlocked(response);

  const responseParts = response?.candidates?.[0]?.content?.parts ?? [];
  const image = responseParts.find((p: any) => p?.inlineData?.data);
  if (!image) {
    throw new GeminiError({
      code: "NO_IMAGE",
      message: redact(
        collectText(response).slice(0, 200) ||
          "Gemini returned no image data for this prompt.",
      ),
      retryable: true,
    });
  }

  return {
    mimeType: image.inlineData.mimeType ?? "image/png",
    data: image.inlineData.data,
    model: req.model,
    text: collectText(response) || undefined,
  };
}

/** Used by the health check on the Settings page. */
export async function listModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${GEMINI_API_BASE}/models?pageSize=200`, {
    headers: { "x-goog-api-key": apiKey },
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!res.ok) throw classifyApiError(res.status, parsed);
  return (parsed.models ?? []).map((m: any) =>
    String(m.name).replace(/^models\//, ""),
  );
}

export interface VisionRequest {
  model: string;
  system?: string;
  prompt: string;
  schema?: Record<string, unknown>;
  image?: { mimeType: string; data: string };
}

/** Structured text generation grounded in an attached image. */
export async function generateVisionText(
  req: VisionRequest,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ text: string; model: string }> {
  const parts: any[] = [];
  if (req.image?.data) {
    parts.push({
      inlineData: { mimeType: req.image.mimeType, data: req.image.data },
    });
  }
  parts.push({ text: req.prompt });

  const generationConfig: Record<string, unknown> = { temperature: 0.7 };
  if (req.schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = req.schema;
  }

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig,
  };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };

  const response = await callGemini(req.model, apiKey, body, signal);
  checkBlocked(response);

  const text = collectText(response);
  if (!text.trim()) {
    throw new GeminiError({
      code: "INVALID_OUTPUT",
      message: "Gemini returned an empty analysis.",
      retryable: true,
    });
  }
  return { text, model: req.model };
}
