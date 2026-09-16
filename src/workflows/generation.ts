import type { ImagePromptInput } from "@/prompts/logoExploration";
import { makeConceptCode, makeIterationCode } from "@/prompts/logoExploration";
import { saveAsset } from "@/services/db/assetStore";
import {
  generateLogoConcepts,
  generateLogoImage,
  type ConceptPlan,
} from "@/services/gemini";
import { GeminiError } from "@/services/gemini/errors";
import type {
  ConceptAsset,
  CreativeDirection,
  GenerationJob,
  GenerationSettings,
  IterationInstruction,
  JobItem,
  LockupKind,
  LogoConcept,
  Project,
} from "@/types";
import { newId } from "@/utils/id";

/**
 * Turns design intent into executable generation jobs.
 *
 * Planning (what to draw) is separated from rendering (drawing it) so that the
 * conceptual-diversity requirement is enforced in language, where the model can
 * reason about it, before a single image is requested.
 */

/* ================================================================== */
/* Exploration                                                         */
/* ================================================================== */

export interface PlannedConcept {
  direction: CreativeDirection;
  plan: ConceptPlan;
  code: string;
}

export interface PlanningOutcome {
  planned: PlannedConcept[];
  failures: Array<{ direction: CreativeDirection; message: string }>;
}

/** Phase 1 — ask Gemini to design N distinct concepts per approved direction. */
export async function planExploration(
  project: Project,
  directions: CreativeDirection[],
  perDirection: number,
  settings: GenerationSettings,
  options?: {
    guidance?: string;
    onDirectionPlanned?: (direction: CreativeDirection, count: number) => void;
    signal?: AbortSignal;
  },
): Promise<PlanningOutcome> {
  const failures: PlanningOutcome["failures"] = [];

  /* Each direction is planned against the same project snapshot, so there is
     no ordering dependency between them — running them together turns the
     wait before the first image from minutes into seconds. */
  const results = await Promise.all(
    directions.map(async (direction): Promise<PlannedConcept[]> => {
      try {
        const plans = await generateLogoConcepts(
          project,
          direction,
          perDirection,
          settings,
          options?.guidance,
          options?.signal,
        );

        const existing = project.concepts.filter(
          (c) => c.directionId === direction.id && c.iterationNumber === 0,
        ).length;

        options?.onDirectionPlanned?.(direction, plans.length);

        return plans.slice(0, perDirection).map((plan, i) => ({
          direction,
          plan,
          code: makeConceptCode(direction.number, existing + i),
        }));
      } catch (err) {
        // One direction failing must not cost the others their work.
        failures.push({ direction, message: GeminiError.from(err).message });
        return [];
      }
    }),
  );

  // Keep the designer-facing order stable: direction 1 first, then 2, and so on.
  return { planned: results.flat(), failures };
}

/** Phase 2 — one job item per planned concept. */
export function createExplorationJob(
  project: Project,
  planned: PlannedConcept[],
): GenerationJob {
  const now = new Date().toISOString();
  return {
    id: newId("job"),
    projectId: project.id,
    kind: "exploration",
    title: `Logo exploration — ${planned.length} concepts`,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    context: { kind: "exploration" },
    items: planned.map<JobItem>((entry) => ({
      id: newId("item"),
      label: `${entry.code} · ${entry.plan.name}`,
      status: "pending",
      attempts: 0,
      payload: {
        directionId: entry.direction.id,
        code: entry.code,
        plan: entry.plan as unknown as Record<string, unknown>,
      },
    })),
  };
}

/* ================================================================== */
/* Iteration                                                           */
/* ================================================================== */

export function createIterationJob(
  project: Project,
  parent: LogoConcept,
  instruction: IterationInstruction,
): GenerationJob {
  const now = new Date().toISOString();
  const existingChildren = project.concepts.filter(
    (c) => c.parentConceptId === parent.id,
  ).length;

  return {
    id: newId("job"),
    projectId: project.id,
    kind: "iteration",
    title: `Variations of ${parent.code} — ${instruction.intent}`,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    context: {
      kind: "iteration",
      parentConceptId: parent.id,
      instruction: instruction as unknown as Record<string, unknown>,
    },
    items: instruction.explore.map<JobItem>((focus, i) => ({
      id: newId("item"),
      label: `${makeIterationCode(parent.code, existingChildren + i)} · ${focus.slice(0, 60)}`,
      status: "pending",
      attempts: 0,
      payload: {
        parentConceptId: parent.id,
        code: makeIterationCode(parent.code, existingChildren + i),
        variationFocus: focus,
        instruction: instruction as unknown as Record<string, unknown>,
      },
    })),
  };
}

/* ================================================================== */
/* Lockups (finalists + delivery)                                      */
/* ================================================================== */

export function createLockupJob(
  project: Project,
  concept: LogoConcept,
  lockups: Array<{ kind: LockupKind; instruction: string; purpose: string }>,
  consistencyNote: string,
  kind: "finalist_lockups" | "delivery_assets",
): GenerationJob {
  const now = new Date().toISOString();
  return {
    id: newId("job"),
    projectId: project.id,
    kind,
    title: `${kind === "finalist_lockups" ? "Lockups" : "Delivery assets"} for ${concept.code}`,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    context: { kind, conceptId: concept.id, consistencyNote },
    items: lockups.map<JobItem>((lockup) => ({
      id: newId("item"),
      label: `${concept.code} · ${lockup.kind}`,
      status: "pending",
      attempts: 0,
      payload: {
        conceptId: concept.id,
        lockupKind: lockup.kind,
        instruction: lockup.instruction,
        consistencyNote,
      },
    })),
  };
}

/* ================================================================== */
/* Item execution                                                      */
/* ================================================================== */

export interface ExecutorContext {
  /** Always read through a getter — the project changes as items complete. */
  getProject: () => Project;
  settings: GenerationSettings;
  /** Persist a newly generated concept. */
  onConcept: (concept: LogoConcept) => Promise<void>;
  /** Persist a lockup asset onto an existing concept. */
  onLockup: (conceptId: string, asset: ConceptAsset) => Promise<void>;
}

/**
 * Executes one job item. Every branch ends with the artwork written to
 * IndexedDB before the item is reported done, so a completed item survives a
 * refresh even if the rest of the batch later fails.
 */
export function makeExecutor(ctx: ExecutorContext) {
  return async (item: JobItem, signal: AbortSignal): Promise<{ conceptId?: string }> => {
    const project = ctx.getProject();
    const payload = item.payload;

    if (payload.lockupKind) {
      return executeLockup(project, payload, ctx, signal);
    }
    if (payload.parentConceptId) {
      return executeIteration(project, payload, ctx, signal);
    }
    return executeExploration(project, payload, ctx, signal);
  };
}

async function executeExploration(
  project: Project,
  payload: Record<string, any>,
  ctx: ExecutorContext,
  signal: AbortSignal,
): Promise<{ conceptId: string }> {
  const direction = project.directions.find((d) => d.id === payload.directionId);
  if (!direction) throw new Error("The creative direction for this item no longer exists.");
  if (!project.brief) throw new Error("The brand brief is missing.");

  const plan = payload.plan as ConceptPlan;

  const input: ImagePromptInput = {
    brief: project.brief,
    direction,
    objective: plan.objective,
    formDescription: plan.formDescription,
    typographyNote: plan.typographyNote,
    colorNote: plan.colorNote,
    constraints: project.feedbackMemory.constraints,
    exactCompanyName: project.companyName,
    includeWordmark: true,
  };

  const image = await generateLogoImage(input, ctx.settings, { signal });
  const assetId = await saveAsset(project.id, image.data, image.mimeType);

  const concept = buildConcept({
    project,
    code: payload.code,
    directionId: direction.id,
    plan,
    assetId,
    image,
    parent: undefined,
    objective: plan.objective,
  });

  await ctx.onConcept(concept);
  return { conceptId: concept.id };
}

async function executeIteration(
  project: Project,
  payload: Record<string, any>,
  ctx: ExecutorContext,
  signal: AbortSignal,
): Promise<{ conceptId: string }> {
  const parent = project.concepts.find((c) => c.id === payload.parentConceptId);
  if (!parent) throw new Error("The parent concept no longer exists.");
  const direction = project.directions.find((d) => d.id === parent.directionId);
  if (!direction) throw new Error("The creative direction for this concept no longer exists.");
  if (!project.brief) throw new Error("The brand brief is missing.");

  const instruction = payload.instruction as IterationInstruction;

  const input: ImagePromptInput = {
    brief: project.brief,
    direction,
    objective: instruction.intent,
    formDescription: parent.description,
    constraints: project.feedbackMemory.constraints,
    exactCompanyName: project.companyName,
    includeWordmark: true,
    iteration: {
      parent,
      instruction,
      variationFocus: payload.variationFocus,
    },
  };

  // The parent image travels with the request so the model evolves the mark
  // rather than reinventing it.
  const reference = await referenceFor(parent);

  const image = await generateLogoImage(input, ctx.settings, {
    signal,
    referenceImages: reference ? [reference] : undefined,
  });
  const assetId = await saveAsset(project.id, image.data, image.mimeType);

  const concept = buildConcept({
    project,
    code: payload.code,
    directionId: parent.directionId,
    plan: {
      name: payload.variationFocus.slice(0, 48),
      objective: payload.variationFocus,
      description: `${parent.description}\n\nVariation: ${payload.variationFocus}`,
      rationale: instruction.intent,
      formDescription: parent.description,
      symbolIdea: "",
      typographyNote: "",
      colorNote: "",
    },
    assetId,
    image,
    parent,
    objective: payload.variationFocus,
  });

  await ctx.onConcept(concept);
  return { conceptId: concept.id };
}

async function executeLockup(
  project: Project,
  payload: Record<string, any>,
  ctx: ExecutorContext,
  signal: AbortSignal,
): Promise<{ conceptId: string }> {
  const concept = project.concepts.find((c) => c.id === payload.conceptId);
  if (!concept) throw new Error("The concept no longer exists.");
  const direction = project.directions.find((d) => d.id === concept.directionId);
  if (!direction) throw new Error("The creative direction no longer exists.");
  if (!project.brief) throw new Error("The brand brief is missing.");

  const kind = payload.lockupKind as LockupKind;
  const symbolOnly = kind === "symbol" || kind === "favicon";

  const input: ImagePromptInput = {
    brief: project.brief,
    direction,
    objective: `Produce the ${kind} lockup`,
    formDescription: concept.description,
    constraints: project.feedbackMemory.constraints,
    exactCompanyName: concept.typography.exactCompanyName || project.companyName,
    includeWordmark: !symbolOnly,
    lockup: {
      kind,
      instruction: payload.instruction,
      consistencyNote: payload.consistencyNote,
    },
  };

  const reference = await referenceFor(concept);

  const image = await generateLogoImage(input, ctx.settings, {
    // Lockups are deliverables — use the higher-fidelity model.
    model: ctx.settings.finalistImageModel,
    signal,
    referenceImages: reference ? [reference] : undefined,
  });
  const assetId = await saveAsset(project.id, image.data, image.mimeType);

  await ctx.onLockup(concept.id, {
    kind,
    assetId,
    mimeType: image.mimeType,
    derivedFrom: concept.primaryAssetId,
    meta: {
      model: image.model,
      aspectRatio: ctx.settings.aspectRatio,
      prompt: image.prompt,
      inputs: { lockupKind: kind, conceptId: concept.id },
      generatedAt: new Date().toISOString(),
      durationMs: image.durationMs,
      attempt: 1,
    },
  });

  return { conceptId: concept.id };
}

/** Load a concept's artwork as a reference image for consistency. */
async function referenceFor(
  concept: LogoConcept,
): Promise<{ mimeType: string; data: string } | null> {
  if (!concept.primaryAssetId) return null;
  const { getAssetBase64 } = await import("@/services/db/assetStore");
  return getAssetBase64(concept.primaryAssetId);
}

function buildConcept(args: {
  project: Project;
  code: string;
  directionId: string;
  plan: ConceptPlan;
  assetId: string;
  image: { mimeType: string; model: string; prompt: string; durationMs: number };
  parent?: LogoConcept;
  objective: string;
}): LogoConcept {
  const now = new Date().toISOString();
  const { parent } = args;

  const asset: ConceptAsset = {
    kind: "primary",
    assetId: args.assetId,
    mimeType: args.image.mimeType,
    meta: {
      model: args.image.model,
      aspectRatio: "1:1",
      prompt: args.image.prompt,
      inputs: {
        directionId: args.directionId,
        parentConceptId: parent?.id,
        objective: args.objective,
      },
      generatedAt: now,
      durationMs: args.image.durationMs,
      attempt: 1,
    },
  };

  return {
    id: newId("cpt"),
    code: args.code,
    name: args.plan.name,
    directionId: args.directionId,
    description: args.plan.description,
    rationale: args.plan.rationale,
    objective: args.objective,
    assets: [asset],
    primaryAssetId: args.assetId,
    parentConceptId: parent?.id,
    iterationNumber: parent ? parent.iterationNumber + 1 : 0,
    lineage: parent ? [...parent.lineage, parent.id] : [],
    status: "new",
    rating: 0,
    comments: [],
    notes: "",
    clientVisible: false,
    typography: {
      exactCompanyName: args.project.companyName,
      renderedTextVerified: false,
      fontRecommendations: [],
    },
    generation: parent ? parent.generation + 1 : 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** The standard lockup family built for every finalist. */
export const FINALIST_LOCKUPS: LockupKind[] = [
  "symbol",
  "wordmark",
  "horizontal",
  "stacked",
  "monochrome",
  "reversed",
  "small",
];

export const DELIVERY_LOCKUPS: LockupKind[] = [
  "primary",
  "secondary",
  "symbol",
  "wordmark",
  "monochrome",
  "reversed",
  "small",
  "favicon",
];

/**
 * Deterministic lockup instructions.
 *
 * Finalist lockups are a reproduction exercise, so the instructions are fixed
 * in code rather than generated. That keeps the family internally consistent
 * and avoids spending a model call on text that should never vary.
 */
export function standardLockupInstruction(
  kind: LockupKind,
  concept: LogoConcept,
  companyName: string,
): { kind: LockupKind; instruction: string; purpose: string } {
  const mark = `The approved mark is: ${concept.description}`;

  const map: Record<LockupKind, { instruction: string; purpose: string }> = {
    primary: {
      instruction: `${mark}\nReproduce the primary lockup exactly as approved: symbol and the wordmark "${companyName}" in their approved arrangement.`,
      purpose: "The default logo used everywhere unless a context demands otherwise.",
    },
    secondary: {
      instruction: `${mark}\nProduce an alternate arrangement of the same symbol and wordmark for contexts where the primary lockup does not fit — a different axis or balance, with no change to either element.`,
      purpose: "For layouts the primary lockup cannot serve.",
    },
    symbol: {
      instruction: `${mark}\nReproduce the symbol alone at its approved proportions. Render absolutely no text of any kind.`,
      purpose: "App icons, favicons, embroidery, and standalone brand moments.",
    },
    wordmark: {
      instruction: `${mark}\nReproduce only the wordmark "${companyName}", set in the approved typographic treatment. No symbol, no other elements.`,
      purpose: "Contexts where the symbol is redundant or too small to read.",
    },
    horizontal: {
      instruction: `${mark}\nArrange the symbol to the left of the wordmark "${companyName}", optically centred on the wordmark's cap height, with clear space between them equal to the symbol's width divided by two.`,
      purpose: "Website headers, email signatures, and wide layouts.",
    },
    stacked: {
      instruction: `${mark}\nArrange the symbol centred directly above the wordmark "${companyName}", both optically centred on a shared vertical axis.`,
      purpose: "Square and portrait spaces, merchandise, and signage.",
    },
    monochrome: {
      instruction: `${mark}\nReproduce the primary lockup in a single flat black, on white. No greys, no tints, no gradients — one solid colour only.`,
      purpose: "Single-colour print, engraving, embroidery, and fax-grade reproduction.",
    },
    reversed: {
      instruction: `${mark}\nReproduce the primary lockup in solid white, knocked out of a solid dark background. This is a knockout, not an inverted redraw — the mark's geometry is unchanged.`,
      purpose: "Dark backgrounds, photography overlays, and dark-mode interfaces.",
    },
    small: {
      instruction: `${mark}\nReproduce the mark optimised for small sizes: open up tight counters, thicken hairlines to survive reduction, and drop any detail that closes up below 24 pixels. The mark's identity and silhouette must remain unmistakably the same.`,
      purpose: "Anywhere the logo appears below roughly 24 pixels.",
    },
    favicon: {
      instruction: `${mark}\nReproduce the symbol alone, simplified for a 16 pixel square: maximum contrast, generous counters, no text whatsoever. It must read clearly as a browser tab icon.`,
      purpose: "Browser tabs, app tiles, and notification badges.",
    },
  };

  return { kind, ...map[kind] };
}

export const LOCKUP_CONSISTENCY_NOTE =
  "Proportions, stroke weight relationships, angles, corner treatment, and the spacing between elements must be identical to the approved mark. This is reproduction, not redesign — do not reinterpret, restyle, or improve the artwork.";
