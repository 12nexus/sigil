import type { CreativeDirection, Project } from "@/types";
import {
  JSON_DISCIPLINE,
  STUDIO_PERSONA,
  compose,
  serializeBrief,
  serializeConstraints,
  serializeDirection,
  serializeRejections,
} from "./shared";

/**
 * Creative territories, not logo variations. The hard requirement is that each
 * direction represents a genuinely different *idea*, so that the exploration
 * that follows covers real design space instead of colour permutations.
 */
export function buildCreativeDirectionsPrompt(
  project: Project,
  count: number,
  extraGuidance?: string,
): string {
  if (!project.brief) throw new Error("Brand brief required");

  return compose(
    `# Task
Develop ${count} fundamentally different creative territories for this brand's identity. These are strategic design directions, not finished logos and not variations of one another.`,

    `## Approved brand brief
${serializeBrief(project.brief)}`,

    serializeConstraints(project.feedbackMemory.constraints),
    serializeRejections(project),
    extraGuidance ? `## Additional guidance from the designer\n${extraGuidance}` : "",

    `## What makes a territory distinct
Two directions are only distinct if a lay person could describe how they differ without mentioning colour. Distinctness comes from the *type of idea*: what the mark is built from, what it represents, and how it is constructed.

Territories may draw on approaches such as abstract symbol, monogram, lettermark, wordmark-only, negative space, pure geometry, symbolic metaphor, dynamic transformation, modular or systemic marks, or conceptual minimalism — but choose the approaches that genuinely serve THIS brand. Do not walk down that list mechanically. If a monogram is wrong for this company, do not include one.

Requirements:
- Every territory must be defensible from the brief. If you cannot explain why it fits this brand specifically, replace it.
- At least two territories should be conceptually adventurous — territory a cautious designer would not propose first.
- At least two should be commercially safe and obviously presentable to a conservative client.
- Be honest in the risks field. A territory with no stated risk has not been thought through.
- Differentiation must reference the actual named competitors where they exist.
- Do not describe finished artwork. Describe the idea and the principle that generates artwork.`,

    JSON_DISCIPLINE,
  );
}

export function buildDirectionCritiquePrompt(
  project: Project,
  directions: CreativeDirection[],
): string {
  return compose(
    `# Task
Review this set of creative territories as a design director would before a client presentation. Identify any that overlap conceptually, any that are weaker than they appear, and any obvious territory that is missing. Be concise and direct. Do not rank them.`,
    project.brief ? `## Brief\n${serializeBrief(project.brief)}` : "",
    `## Territories\n${directions.map(serializeDirection).join("\n\n---\n\n")}`,
  );
}

export const CREATIVE_DIRECTIONS_SYSTEM = STUDIO_PERSONA;
