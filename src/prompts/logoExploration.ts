import type {
  BrandBrief,
  Constraint,
  CreativeDirection,
  IterationInstruction,
  LockupKind,
  LogoConcept,
  Project,
} from "@/types";
import {
  JSON_DISCIPLINE,
  STUDIO_PERSONA,
  compose,
  conceptSummary,
  serializeBrief,
  serializeConstraints,
  serializeDirection,
  serializeEndorsements,
  serializeRejections,
} from "./shared";

/* ================================================================== */
/* PHASE 1 — plan the concepts (text model)                            */
/* ================================================================== */

/**
 * Before any image is generated, Gemini plans N conceptually distinct marks
 * for a direction. This is what prevents "40 nearly identical logos": the
 * diversity requirement is enforced at the planning stage, in language, where
 * the model can actually reason about it.
 */
export function buildConceptPlanPrompt(
  project: Project,
  direction: CreativeDirection,
  count: number,
  guidance?: string,
): string {
  if (!project.brief) throw new Error("Brand brief required");

  const siblings = project.concepts.filter((c) => c.directionId === direction.id);

  return compose(
    `# Task
Design ${count} distinct logo concepts inside a single creative territory. Each concept is a different answer to the same strategic question — not a restyling of the same answer.`,

    `## Brand brief
${serializeBrief(project.brief)}`,

    `## The territory you are working inside
${serializeDirection(direction)}`,

    serializeConstraints(project.feedbackMemory.constraints),
    serializeRejections(project),
    serializeEndorsements(project),

    siblings.length
      ? `## Concepts already generated in this territory (do not repeat these ideas)\n${siblings
          .map((c) => `- ${c.code} ${c.name}: ${c.objective}`)
          .join("\n")}`
      : "",

    guidance ? `## Specific guidance from the designer\n${guidance}` : "",

    `## Diversity requirement (this is the point of the exercise)
The ${count} concepts must differ in *construction*, not in styling. Vary things like:
- what the mark is built from (a letterform, a geometric primitive, a modular unit, a gesture, a container)
- how it is constructed (stacked, rotated, intersected, subtracted, repeated, unfolded)
- the relationship between symbol and wordmark (integrated, adjacent, symbol-only, wordmark-only)
- the degree of abstraction (literal, reduced, fully abstract)
- the compositional posture (contained, open, asymmetric, axial)

If two of your concepts could be described with the same sentence, one of them is wasted. Replace it.

## formDescription field — the most important field
This text is fed directly to an image model. Write it as a precise visual specification, the way you would brief an illustrator:
- Describe geometry, construction, proportion, weight, and negative space concretely.
- Say what the mark IS, not what it represents. "Three stacked parallelograms shearing 15 degrees to the right, the middle one shortened" — not "a dynamic mark evoking momentum".
- Keep it to 2–4 sentences of dense visual description.
- Do not include brand strategy language, adjectives about feelings, or the company's mission.
- Do not describe backgrounds, mockups, lighting, or presentation context.`,

    JSON_DISCIPLINE,
  );
}

/* ================================================================== */
/* PHASE 2 — the image prompt engine                                   */
/* ================================================================== */

/**
 * Hard rules applied to every image request. These exist because image models
 * default to "dribbble logo mockup" output unless actively steered away.
 */
const UNIVERSAL_NEGATIVES = [
  "no mockups, no business cards, no signage, no buildings, no walls, no merchandise, no packaging, no devices",
  "no 3D rendering, no extrusion, no bevel, no emboss, no drop shadows, no reflections, no glossy highlights",
  "no photorealism, no photographic elements, no textures, no grain, no paper texture",
  "no decorative backgrounds, no scenery, no patterns behind the mark, no coloured background panels",
  "no gradients unless explicitly specified in the concept",
  "no multiple unrelated symbols in one composition, no icon sheets, no grids of variations",
  "no tiny illegible text, no lorem ipsum, no taglines unless specified",
  "no generic stock-logo tropes: swooshes, globes, abstract human figures, lightbulbs, gears, checkmarks, speech bubbles, hexagon tech badges, neural-network node clusters, circuit-board traces",
  "no watermarks, no signatures, no borders, no frames, no crop marks",
];

const UNIVERSAL_POSITIVES = [
  "professional brand identity design of the calibre presented by a top-tier identity studio",
  "flat vector aesthetic with clean hard edges and mathematically confident geometry",
  "a single, unified mark presented once, centred, with generous margin",
  "strong readable silhouette that survives at 16 pixels",
  "works in pure black on white with no loss of meaning",
  "pure white background, high contrast, no environmental context",
];

export interface ImagePromptInput {
  brief: BrandBrief;
  direction: CreativeDirection;
  /** The planned concept's objective. */
  objective: string;
  /** The planned concept's precise visual specification. */
  formDescription: string;
  typographyNote?: string;
  colorNote?: string;
  constraints: Constraint[];
  /** Exact company name, typed by the human — never trusted to the AI. */
  exactCompanyName: string;
  /** For iterations. */
  iteration?: {
    parent: LogoConcept;
    instruction: IterationInstruction;
    variationFocus: string;
  };
  /** For finalist lockups and delivery assets. */
  lockup?: {
    kind: LockupKind;
    instruction: string;
    consistencyNote: string;
  };
  /** Whether to include the wordmark at all. */
  includeWordmark: boolean;
}

/**
 * The dynamic image prompt generator.
 *
 * Every image request in the application is built here, from structured data.
 * Nothing else in the codebase writes an image prompt.
 */
export function buildImagePrompt(input: ImagePromptInput): string {
  const sections: string[] = [];

  /* --- What to draw ------------------------------------------------ */

  if (input.lockup) {
    sections.push(
      `TASK: Produce the ${formatLockupName(input.lockup.kind)} of an already-approved logo.

${input.lockup.instruction}

CRITICAL: This is a reproduction task, not a redesign. The mark's geometry, proportion, and construction must remain identical to the reference. ${input.lockup.consistencyNote}`,
    );
  } else if (input.iteration) {
    const { parent, instruction, variationFocus } = input.iteration;
    sections.push(
      `TASK: Produce a refined variation of an existing logo concept.

THE EXISTING CONCEPT:
${parent.description}

WHAT THIS VARIATION MUST PRESERVE:
${list(instruction.preserve)}

WHAT MUST CHANGE:
${list(instruction.change)}

${instruction.remove.length ? `WHAT MUST BE REMOVED ENTIRELY:\n${list(instruction.remove)}\n` : ""}THIS SPECIFIC VARIATION EXPLORES:
${variationFocus}

This is a controlled evolution of a mark the designer already likes. Do not start over. Do not introduce a new concept.`,
    );
  } else {
    sections.push(
      `TASK: Design a single original logo mark.

THE MARK:
${input.formDescription}

CONCEPTUAL OBJECTIVE:
${input.objective}

CREATIVE TERRITORY: ${input.direction.name} — ${input.direction.summary}
FORM LANGUAGE: ${input.direction.visualPrinciple}`,
    );
  }

  /* --- Typography -------------------------------------------------- */

  if (input.includeWordmark) {
    sections.push(
      `TYPOGRAPHY:
The wordmark must read exactly: ${input.exactCompanyName}
Spell it precisely — letter for letter, with this exact capitalisation. Do not add, drop, or substitute any character. Do not add a tagline, a legal suffix, or any other text.
Set it in a professionally drawn typeface with even letterspacing and optically corrected alignment.
${input.typographyNote || input.direction.typography}`,
    );
  } else {
    sections.push(
      `TYPOGRAPHY:
Symbol only. Render NO text whatsoever — no company name, no letters, no tagline, no caption, no label.`,
    );
  }

  /* --- Colour ------------------------------------------------------ */

  sections.push(
    `COLOUR:
${input.colorNote || input.direction.colorApproach}
${input.brief.visualLanguage.colorDirection}
Keep the palette to at most two colours plus neutrals. The mark must remain legible if reduced to one flat colour.`,
  );

  /* --- Brand guardrails from the brief ------------------------------ */

  const briefAvoid = [
    ...input.brief.avoid.cliches,
    ...input.brief.avoid.styles,
    ...input.brief.avoid.competitorSimilarities,
  ].filter(Boolean);

  if (briefAvoid.length) {
    sections.push(
      `BRAND-SPECIFIC PROHIBITIONS (from the approved brief):
${list(briefAvoid)}`,
    );
  }

  /* --- Accumulated feedback memory ---------------------------------- */

  const active = input.constraints.filter((c) => c.active);
  const positive = active.filter((c) => c.polarity === "positive").map((c) => c.text);
  const negative = active.filter((c) => c.polarity === "negative").map((c) => c.text);

  if (positive.length) {
    sections.push(`ENDORSED QUALITIES (the designer has confirmed these work — honour them):\n${list(positive)}`);
  }
  if (negative.length) {
    sections.push(`REJECTED QUALITIES (hard constraints — any of these makes the output unusable):\n${list(negative)}`);
  }

  /* --- Universal craft rules ---------------------------------------- */

  sections.push(`EXECUTION STANDARD:\n${list(UNIVERSAL_POSITIVES)}`);
  sections.push(`DO NOT PRODUCE:\n${list(UNIVERSAL_NEGATIVES)}`);
  sections.push(
    `OUTPUT: One logo, centred on a plain white background, with clear margin on all sides. Nothing else in the frame.`,
  );

  return sections.join("\n\n");
}

function list(items: string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}

export function formatLockupName(kind: LockupKind): string {
  const names: Record<LockupKind, string> = {
    primary: "primary lockup",
    secondary: "secondary lockup",
    symbol: "symbol-only mark",
    wordmark: "wordmark-only version",
    horizontal: "horizontal lockup",
    stacked: "stacked (vertical) lockup",
    monochrome: "single-colour black version",
    reversed: "reversed (knockout) version for dark backgrounds",
    small: "small-size optimised version",
    favicon: "favicon / app icon version",
  };
  return names[kind];
}

/* ================================================================== */
/* Helper: concept naming                                              */
/* ================================================================== */

/** Concept codes read like "2A", "2B" … and iterations like "2A.1". */
export function makeConceptCode(directionNumber: number, index: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < 26) return `${directionNumber}${letters[index]}`;
  const first = Math.floor(index / 26) - 1;
  return `${directionNumber}${letters[first]}${letters[index % 26]}`;
}

export function makeIterationCode(parentCode: string, index: number): string {
  return `${parentCode}.${index + 1}`;
}

export const LOGO_EXPLORATION_SYSTEM = STUDIO_PERSONA;

/** Re-exported so the critique prompt can describe a concept consistently. */
export { conceptSummary };
