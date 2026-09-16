import type { GenerationSettings } from "@/types";

/**
 * Model configuration.
 *
 * Defaults live here; every value is overridable by environment variable at
 * build time and by the Settings page at runtime. Nothing in the UI hardcodes
 * a model name.
 */

const env = (key: string, fallback: string): string => {
  const raw = process.env[key];
  return raw && raw.trim().length > 0 ? raw.trim() : fallback;
};

export const DEFAULT_SETTINGS: GenerationSettings = {
  /** Fast, structured-output capable. Used for most interview/brief work. */
  textModel: env("NEXT_PUBLIC_GEMINI_TEXT_MODEL", "gemini-3.8-flash"),
  /** Heavier reasoning: brief synthesis, critique, creative directions. */
  reasoningModel: env("NEXT_PUBLIC_GEMINI_REASONING_MODEL", "gemini-3.8-flash"),
  /** Batch exploration — speed matters, dozens of images per run. */
  imageModel: env("NEXT_PUBLIC_GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image"),
  /** Finalists and delivery assets — quality matters more than speed. */
  finalistImageModel: env(
    "NEXT_PUBLIC_GEMINI_FINALIST_IMAGE_MODEL",
    "gemini-3-pro-image",
  ),
  batchConcurrency: Number(env("NEXT_PUBLIC_BATCH_CONCURRENCY", "3")),
  maxRetries: Number(env("NEXT_PUBLIC_MAX_RETRIES", "2")),
  defaultDirectionCount: Number(env("NEXT_PUBLIC_DEFAULT_DIRECTIONS", "8")),
  defaultConceptsPerDirection: Number(
    env("NEXT_PUBLIC_DEFAULT_CONCEPTS_PER_DIRECTION", "6"),
  ),
  defaultIterationCount: Number(env("NEXT_PUBLIC_DEFAULT_ITERATIONS", "4")),
  aspectRatio: env("NEXT_PUBLIC_IMAGE_ASPECT_RATIO", "1:1"),
};

/** Models offered in the Settings dropdowns. Free text is also allowed. */
export const KNOWN_TEXT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
];

export const KNOWN_IMAGE_MODELS = [
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
  "gemini-3.1-flash-lite-image",
  "gemini-2.5-flash-image",
];

export const MODEL_NOTES: Record<string, string> = {
  "gemini-3.1-flash-image": "Nano Banana 2 — fast, ideal for large exploration batches.",
  "gemini-3-pro-image": "Nano Banana Pro — highest fidelity, best for finalists and delivery.",
  "gemini-3.1-flash-lite-image": "Nano Banana 2 Lite — cheapest, lowest fidelity.",
  "gemini-2.5-flash-image": "Nano Banana — previous generation.",
  "gemini-3.8-flash": "Latest Flash reasoning model. Recommended default.",
  "gemini-3.1-pro-preview": "Deepest reasoning. Slower and more expensive.",
};

export const GEMINI_API_BASE =
  process.env.GEMINI_API_BASE?.trim() ||
  "https://generativelanguage.googleapis.com/v1beta";

export const REQUEST_TIMEOUT_MS = Number(
  process.env.GEMINI_TIMEOUT_MS || "180000",
);
