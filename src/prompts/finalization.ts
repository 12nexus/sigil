import type { FinalizationPlan, LogoConcept, Project } from "@/types";
import {
  JSON_DISCIPLINE,
  STUDIO_PERSONA,
  compose,
  conceptSummary,
  serializeBrief,
} from "./shared";

/**
 * Finalization is a reproduction exercise, not a design exercise. The prompts
 * here are written to lock the approved mark and vary only its presentation.
 */
export function buildFinalizationInstructionsPrompt(
  project: Project,
  concept: LogoConcept,
  plan: FinalizationPlan,
): string {
  return compose(
    `# Task
The client has approved this logo. Produce the image-generation instructions needed to build out the full logo system from it.`,

    `## The approved mark
${conceptSummary(concept)}
Exact company name for every wordmark: ${concept.typography.exactCompanyName}`,

    project.brief ? `## Brief\n${serializeBrief(project.brief)}` : "",

    `## The designer's finalization decisions
Colour strategy: ${plan.colorStrategy === "retain_existing" ? `retain existing brand colours (${plan.existingColors.join(", ") || "none listed"})` : plan.colorStrategy === "new_palette" ? "build a new palette" : "hybrid — keep some existing colour, extend it"}
Typography pairing needed: ${plan.needsTypographyPairing ? "yes" : "no"}
Spacing rules needed: ${plan.needsSpacingRules ? "yes" : "no"}
Minimum size rules needed: ${plan.needsMinimumSize ? "yes" : "no"}
Usage guidelines needed: ${plan.needsUsageGuidelines ? "yes" : "no"}
${plan.additionalNotes ? `Additional notes: ${plan.additionalNotes}` : ""}`,

    `## Standards
- Every instruction must treat the approved mark as fixed. The geometry does not change between lockups — only arrangement, colour, and scale-appropriate optical adjustment.
- Write each instruction so an image model reproduces the same mark rather than reinterpreting it. Restate the mark's construction concretely in each instruction.
- The favicon and small-size instructions should specify the simplification that is genuinely necessary at that scale (dropping the wordmark, opening up counters), without altering the symbol's identity.
- The reversed version is a knockout for dark backgrounds, not an inverted-colour redraw.
- consistencyNote must name the specific attributes that must not drift: proportions, stroke weight relationships, angles, and spacing.`,

    JSON_DISCIPLINE,
  );
}

export function buildBrandKitPrompt(
  project: Project,
  concept: LogoConcept,
  plan: FinalizationPlan,
): string {
  return compose(
    `# Task
Write the brand kit for this approved identity: palette, typography, and the usage rules that keep the mark intact in other people's hands.`,

    `## The approved mark
${conceptSummary(concept)}
Company name as it must always be set: ${concept.typography.exactCompanyName}`,

    project.brief ? `## Brief\n${serializeBrief(project.brief)}` : "",

    `## Colour strategy
${plan.colorStrategy === "retain_existing" ? `Retain these existing brand colours and build the system around them: ${plan.existingColors.join(", ")}` : plan.colorStrategy === "new_palette" ? "Design a new palette from scratch, derived from the mark and the brief." : `Extend these existing colours into a fuller system: ${plan.existingColors.join(", ")}`}
${plan.additionalNotes}`,

    `## Standards
- Every hex value must be a real, considered colour. Include an ink, a surface, and at least one accent alongside the primary.
- Contrast notes must be accurate about WCAG AA on the intended background.
- Typefaces must be real and obtainable, with the source named.
- Clear space must be expressed relative to a measurable feature of the mark itself, so it scales.
- Minimum sizes must be concrete: pixels for digital, millimetres for print.
- The do/don't lists should address the abuses this specific mark will actually suffer — stretching, recolouring, adding effects, placing on busy backgrounds, reconstructing it in the wrong typeface.
- Write the rationale as the closing paragraph of a real brand document.`,

    JSON_DISCIPLINE,
  );
}

export const FINALIZATION_SYSTEM = STUDIO_PERSONA;
