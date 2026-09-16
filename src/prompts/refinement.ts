import type { LogoConcept, Project } from "@/types";
import {
  JSON_DISCIPLINE,
  STUDIO_PERSONA,
  compose,
  conceptSummary,
  serializeBrief,
  serializeConstraints,
} from "./shared";

/**
 * The iteration engine converts a designer's natural-language reaction
 * ("keep the symbol but make it more premium") into structured, executable
 * design instructions — and into durable constraints for future rounds.
 */
export function buildIterationInstructionPrompt(
  project: Project,
  parent: LogoConcept,
  feedback: string,
  variationCount: number,
): string {
  const lineage = parent.lineage
    .map((id) => project.concepts.find((c) => c.id === id))
    .filter(Boolean) as LogoConcept[];

  return compose(
    `# Task
The designer has given feedback on a specific logo concept and wants ${variationCount} variations. Convert their feedback into precise design instructions, and define ${variationCount} genuinely different ways to satisfy it.`,

    `## The concept being refined
${conceptSummary(parent)}`,

    lineage.length > 1
      ? `## How this concept got here
${lineage.map((c) => `- ${c.code} ${c.name}: ${c.objective}`).join("\n")}`
      : "",

    parent.critique
      ? `## Existing AI critique of this concept
Concerns raised: ${parent.critique.concerns.join("; ") || "none"}
Technical problems: ${parent.critique.technicalProblems.join("; ") || "none"}`
      : "",

    `## The designer's feedback (verbatim)
"${feedback}"`,

    project.brief ? `## Brief\n${serializeBrief(project.brief)}` : "",
    serializeConstraints(project.feedbackMemory.constraints),

    `## Standards
- Read the feedback literally and precisely. "I like the shape but not the typography" means the symbol is locked and only type may move.
- The preserve list is a contract. Anything the designer implied they liked goes there and must not change.
- The explore array must contain exactly ${variationCount} entries — one per variation — and each must be a meaningfully different approach to the same instruction, not a degree-of-intensity slider.
- Each explore entry is written for an image model: concrete and visual, 1–2 sentences, describing what changes in the form.
- newConstraints should capture only durable preferences worth carrying into every future generation. If the feedback is one-off and specific to this concept, return an empty array rather than polluting the memory.
- Do not reinterpret the designer's intent or improve on their idea. Execute it.`,

    JSON_DISCIPLINE,
  );
}

export const REFINEMENT_SYSTEM = STUDIO_PERSONA;
