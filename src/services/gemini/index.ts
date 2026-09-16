import {
  buildBrandBriefPrompt,
  BRAND_BRIEF_SYSTEM,
} from "@/prompts/brandBrief";
import {
  buildClientFeedbackPrompt,
  CLIENT_FEEDBACK_SYSTEM,
} from "@/prompts/clientFeedback";
import {
  buildCreativeDirectionsPrompt,
  buildDirectionCritiquePrompt,
  CREATIVE_DIRECTIONS_SYSTEM,
} from "@/prompts/creativeDirections";
import {
  buildDiscoveryAnalysisPrompt,
  DISCOVERY_SYSTEM,
} from "@/prompts/discovery";
import {
  buildBrandKitPrompt,
  buildFinalizationInstructionsPrompt,
  FINALIZATION_SYSTEM,
} from "@/prompts/finalization";
import {
  buildCritiquePrompt,
  buildFontRecommendationPrompt,
  buildQualityCheckPrompt,
  CRITIQUE_SYSTEM,
} from "@/prompts/logoCritique";
import {
  buildConceptPlanPrompt,
  buildImagePrompt,
  type ImagePromptInput,
  LOGO_EXPLORATION_SYSTEM,
} from "@/prompts/logoExploration";
import {
  buildIterationInstructionPrompt,
  REFINEMENT_SYSTEM,
} from "@/prompts/refinement";
import type {
  BrandBrief,
  BrandKit,
  ClientFeedbackEntry,
  ConceptCritique,
  CreativeDirection,
  DiscoveryAnalysis,
  FeedbackInterpretation,
  FinalizationPlan,
  FontRecommendation,
  GenerationSettings,
  IterationInstruction,
  LockupKind,
  LogoConcept,
  Project,
  QualityCheck,
} from "@/types";
import { requestImage, requestText } from "./client";
import { GeminiError } from "./errors";
import {
  brandBriefSchema,
  brandKitSchema,
  conceptCritiqueSchema,
  conceptPlansSchema,
  creativeDirectionsSchema,
  discoveryAnalysisSchema,
  feedbackInterpretationSchema,
  finalizationInstructionsSchema,
  fontRecommendationsSchema,
  iterationInstructionSchema,
  qualityCheckSchema,
} from "./schemas";

/**
 * The typed Gemini service.
 *
 * This is the only module the rest of the application imports for AI work.
 * UI components never build prompts, never choose models, and never parse
 * model output.
 */

/* ------------------------------------------------------------------ */
/* Structured output plumbing                                          */
/* ------------------------------------------------------------------ */

function parseJson<T>(text: string, context: string): T {
  const trimmed = text.trim();
  // Structured output should be clean JSON, but models occasionally wrap it.
  const candidate = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")
    : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Last resort: pull the outermost JSON object or array.
    const match = candidate.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* fall through */
      }
    }
    throw new GeminiError({
      code: "INVALID_OUTPUT",
      message: `Gemini returned output that could not be read as ${context}.`,
      retryable: true,
    });
  }
}

/** Validate before use, per spec §34. */
function expect<T>(value: T, check: (v: T) => boolean, context: string): T {
  if (!check(value)) {
    throw new GeminiError({
      code: "INVALID_OUTPUT",
      message: `Gemini's ${context} was incomplete or malformed.`,
      retryable: true,
    });
  }
  return value;
}

interface StructuredCall<T> {
  model: string;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  context: string;
  validate: (value: T) => boolean;
  temperature?: number;
  thinkingLevel?: "low" | "medium" | "high";
  signal?: AbortSignal;
}

async function structured<T>(call: StructuredCall<T>): Promise<T> {
  const { text } = await requestText(
    {
      model: call.model,
      system: call.system,
      prompt: call.prompt,
      schema: call.schema,
      temperature: call.temperature,
      thinkingLevel: call.thinkingLevel,
    },
    call.signal,
  );
  const parsed = parseJson<T>(text, call.context);
  return expect(parsed, call.validate, call.context);
}

const nonEmpty = (v: unknown): boolean =>
  typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : Boolean(v);

/* ================================================================== */
/* 1. Discovery                                                        */
/* ================================================================== */

export async function generateBrandQuestions(
  project: Project,
  settings: GenerationSettings,
  signal?: AbortSignal,
): Promise<DiscoveryAnalysis> {
  return structured<DiscoveryAnalysis>({
    model: settings.textModel,
    system: DISCOVERY_SYSTEM,
    prompt: buildDiscoveryAnalysisPrompt(project),
    schema: discoveryAnalysisSchema,
    context: "discovery analysis",
    thinkingLevel: "low",
    validate: (v) =>
      typeof v?.sufficient === "boolean" &&
      Array.isArray(v?.nextQuestions) &&
      (v.sufficient || v.nextQuestions.length > 0),
    signal,
  });
}

/** Alias kept for the naming called out in the spec. */
export const analyzeBrandDiscovery = generateBrandQuestions;

/* ================================================================== */
/* 2. Brand brief                                                      */
/* ================================================================== */

export async function createBrandBrief(
  project: Project,
  settings: GenerationSettings,
  signal?: AbortSignal,
): Promise<BrandBrief> {
  return structured<BrandBrief>({
    model: settings.reasoningModel,
    system: BRAND_BRIEF_SYSTEM,
    prompt: buildBrandBriefPrompt(project),
    schema: brandBriefSchema,
    context: "brand brief",
    thinkingLevel: "high",
    validate: (v) =>
      nonEmpty(v?.company?.name) &&
      nonEmpty(v?.strategicSummary) &&
      Array.isArray(v?.personality) &&
      v.personality.length >= 3,
    signal,
  });
}

/* ================================================================== */
/* 3. Creative directions                                              */
/* ================================================================== */

export interface DirectionsResult {
  directions: Array<Omit<CreativeDirection, "id" | "number" | "status" | "favorite" | "comments" | "editedByUser" | "createdAt">>;
  approachNote: string;
}

export async function generateCreativeDirections(
  project: Project,
  settings: GenerationSettings,
  count: number,
  guidance?: string,
  signal?: AbortSignal,
): Promise<DirectionsResult> {
  return structured<DirectionsResult>({
    model: settings.reasoningModel,
    system: CREATIVE_DIRECTIONS_SYSTEM,
    prompt: buildCreativeDirectionsPrompt(project, count, guidance),
    schema: creativeDirectionsSchema,
    context: "creative directions",
    thinkingLevel: "high",
    temperature: 1.1,
    validate: (v) => Array.isArray(v?.directions) && v.directions.length >= 2,
    signal,
  });
}

export async function critiqueCreativeDirections(
  project: Project,
  directions: CreativeDirection[],
  settings: GenerationSettings,
  signal?: AbortSignal,
): Promise<string> {
  const { text } = await requestText(
    {
      model: settings.reasoningModel,
      system: CREATIVE_DIRECTIONS_SYSTEM,
      prompt: buildDirectionCritiquePrompt(project, directions),
      thinkingLevel: "medium",
    },
    signal,
  );
  return text.trim();
}

/* ================================================================== */
/* 4. Concept planning + logo generation                               */
/* ================================================================== */

export interface ConceptPlan {
  name: string;
  objective: string;
  description: string;
  rationale: string;
  formDescription: string;
  symbolIdea: string;
  typographyNote: string;
  colorNote: string;
}

export async function generateLogoConcepts(
  project: Project,
  direction: CreativeDirection,
  count: number,
  settings: GenerationSettings,
  guidance?: string,
  signal?: AbortSignal,
): Promise<ConceptPlan[]> {
  const result = await structured<{ concepts: ConceptPlan[] }>({
    model: settings.reasoningModel,
    system: LOGO_EXPLORATION_SYSTEM,
    prompt: buildConceptPlanPrompt(project, direction, count, guidance),
    schema: conceptPlansSchema,
    context: "logo concept plan",
    thinkingLevel: "high",
    temperature: 1.15,
    validate: (v) => Array.isArray(v?.concepts) && v.concepts.length > 0,
    signal,
  });
  return result.concepts;
}

export interface LogoImageResult {
  mimeType: string;
  data: string;
  model: string;
  prompt: string;
  durationMs: number;
}

/**
 * The ImageGenerationService abstraction (spec §35). Callers describe what they
 * want in domain terms; the prompt engine and model choice live behind here.
 */
export async function generateLogoImage(
  input: ImagePromptInput,
  settings: GenerationSettings,
  options?: {
    model?: string;
    referenceImages?: Array<{ mimeType: string; data: string }>;
    signal?: AbortSignal;
  },
): Promise<LogoImageResult> {
  const prompt = buildImagePrompt(input);
  const model = options?.model ?? settings.imageModel;
  const started = Date.now();

  const result = await requestImage(
    {
      model,
      prompt,
      aspectRatio: settings.aspectRatio,
      referenceImages: options?.referenceImages,
    },
    options?.signal,
  );

  return {
    mimeType: result.mimeType,
    data: result.data,
    model: result.model || model,
    prompt,
    durationMs: Date.now() - started,
  };
}

/* ================================================================== */
/* 5. Critique                                                         */
/* ================================================================== */

/**
 * Critique is multimodal: the generated image is sent with the prompt so the
 * analysis describes what was actually produced.
 */
export async function critiqueLogoConcept(
  project: Project,
  concept: LogoConcept,
  settings: GenerationSettings,
  image?: { mimeType: string; data: string },
  signal?: AbortSignal,
): Promise<ConceptCritique> {
  const raw = await critiqueWithVision(
    buildCritiquePrompt(project, concept),
    conceptCritiqueSchema,
    "concept critique",
    settings.reasoningModel,
    CRITIQUE_SYSTEM,
    image,
    signal,
  );
  return {
    ...(raw as Omit<ConceptCritique, "createdAt" | "model">),
    createdAt: new Date().toISOString(),
    model: settings.reasoningModel,
  };
}

export async function runQualityCheck(
  project: Project,
  concept: LogoConcept,
  settings: GenerationSettings,
  image?: { mimeType: string; data: string },
  signal?: AbortSignal,
): Promise<QualityCheck> {
  const raw = await critiqueWithVision<Omit<QualityCheck, "createdAt" | "model">>(
    buildQualityCheckPrompt(project, concept),
    qualityCheckSchema,
    "quality checklist",
    settings.reasoningModel,
    CRITIQUE_SYSTEM,
    image,
    signal,
  );
  return {
    ...raw,
    createdAt: new Date().toISOString(),
    model: settings.reasoningModel,
  };
}

/**
 * Vision-grounded structured call. Uses the image endpoint's multimodal input
 * path through a dedicated request so the model can actually see the artwork.
 */
async function critiqueWithVision<T>(
  prompt: string,
  schema: Record<string, unknown>,
  context: string,
  model: string,
  system: string,
  image: { mimeType: string; data: string } | undefined,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch("/api/gemini/vision", {
    method: "POST",
    headers: visionHeaders(),
    body: JSON.stringify({ model, system, prompt, schema, image }),
    signal,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const shape = (payload as any)?.error;
    if (shape?.code) throw new GeminiError(shape);
    throw new GeminiError({
      code: "UNKNOWN",
      message: `Critique request failed (${res.status}).`,
      retryable: true,
    });
  }
  return parseJson<T>((payload as any).text, context);
}

function visionHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const raw = window.localStorage.getItem("sigil.settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.useServerKey === false && parsed?.apiKeyOverride) {
        headers["x-sigil-key"] = String(parsed.apiKeyOverride).trim();
      }
    }
  } catch {
    /* ignore */
  }
  return headers;
}

export async function recommendFonts(
  project: Project,
  concept: LogoConcept,
  settings: GenerationSettings,
  signal?: AbortSignal,
): Promise<{ fonts: FontRecommendation[]; wordmarkNotes: string }> {
  return structured({
    model: settings.reasoningModel,
    system: CRITIQUE_SYSTEM,
    prompt: buildFontRecommendationPrompt(project, concept),
    schema: fontRecommendationsSchema,
    context: "font recommendations",
    thinkingLevel: "medium",
    validate: (v: any) => Array.isArray(v?.fonts) && v.fonts.length > 0,
    signal,
  });
}

/* ================================================================== */
/* 6. Iteration                                                        */
/* ================================================================== */

export async function generateLogoIterations(
  project: Project,
  parent: LogoConcept,
  feedback: string,
  variationCount: number,
  settings: GenerationSettings,
  signal?: AbortSignal,
): Promise<IterationInstruction> {
  return structured<IterationInstruction>({
    model: settings.reasoningModel,
    system: REFINEMENT_SYSTEM,
    prompt: buildIterationInstructionPrompt(project, parent, feedback, variationCount),
    schema: iterationInstructionSchema,
    context: "iteration instructions",
    thinkingLevel: "high",
    validate: (v) =>
      Array.isArray(v?.explore) && v.explore.length > 0 && nonEmpty(v?.intent),
    signal,
  });
}

/* ================================================================== */
/* 7. Client feedback                                                  */
/* ================================================================== */

export async function analyzeClientFeedback(
  project: Project,
  entry: ClientFeedbackEntry,
  concept: LogoConcept | undefined,
  settings: GenerationSettings,
  signal?: AbortSignal,
): Promise<FeedbackInterpretation> {
  return structured<FeedbackInterpretation>({
    model: settings.reasoningModel,
    system: CLIENT_FEEDBACK_SYSTEM,
    prompt: buildClientFeedbackPrompt(project, entry, concept),
    schema: feedbackInterpretationSchema,
    context: "client feedback interpretation",
    thinkingLevel: "medium",
    validate: (v) => nonEmpty(v?.summary),
    signal,
  });
}

/* ================================================================== */
/* 8. Finalization                                                     */
/* ================================================================== */

export interface FinalizationInstructions {
  lockups: Array<{ kind: LockupKind; instruction: string; purpose: string }>;
  consistencyNote: string;
}

export async function generateFinalizationInstructions(
  project: Project,
  concept: LogoConcept,
  plan: FinalizationPlan,
  settings: GenerationSettings,
  signal?: AbortSignal,
): Promise<FinalizationInstructions> {
  return structured<FinalizationInstructions>({
    model: settings.reasoningModel,
    system: FINALIZATION_SYSTEM,
    prompt: buildFinalizationInstructionsPrompt(project, concept, plan),
    schema: finalizationInstructionsSchema,
    context: "finalization instructions",
    thinkingLevel: "high",
    validate: (v) => Array.isArray(v?.lockups) && v.lockups.length > 0,
    signal,
  });
}

export async function generateBrandKit(
  project: Project,
  concept: LogoConcept,
  plan: FinalizationPlan,
  settings: GenerationSettings,
  signal?: AbortSignal,
): Promise<BrandKit> {
  const raw = await structured<Omit<BrandKit, "conceptId" | "generatedAt" | "assetDisclosure">>({
    model: settings.reasoningModel,
    system: FINALIZATION_SYSTEM,
    prompt: buildBrandKitPrompt(project, concept, plan),
    schema: brandKitSchema,
    context: "brand kit",
    thinkingLevel: "high",
    validate: (v: any) => Array.isArray(v?.palette) && v.palette.length > 0,
    signal,
  });

  return {
    ...raw,
    conceptId: concept.id,
    generatedAt: new Date().toISOString(),
    assetDisclosure:
      "Logo files in this kit are AI-generated raster images (PNG/JPEG). They are suitable for review, presentation, and digital comping. They are NOT production-ready vector artwork: before final rollout the approved mark must be redrawn in vector form by a designer working from these references. Colour values, typography, and usage rules in this document are production-ready.",
  };
}

export { GeminiError } from "./errors";
export { ERROR_GUIDANCE } from "./errors";
export { DEFAULT_SETTINGS, KNOWN_IMAGE_MODELS, KNOWN_TEXT_MODELS, MODEL_NOTES } from "./config";
