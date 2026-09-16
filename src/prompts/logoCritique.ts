import type { LogoConcept, Project } from "@/types";
import {
  JSON_DISCIPLINE,
  STUDIO_PERSONA,
  compose,
  conceptSummary,
  serializeBrief,
} from "./shared";

/**
 * The AI design critic. It analyses; it never picks a winner.
 * The concept image is sent alongside this prompt so the critique is grounded
 * in what was actually generated rather than what was requested.
 */
export function buildCritiquePrompt(project: Project, concept: LogoConcept): string {
  return compose(
    `# Task
Critique the attached logo as a design director reviewing work before it goes to a client. You are looking at the actual generated artwork — judge what is in front of you, not what was intended.`,

    project.brief ? `## The brief this must serve\n${serializeBrief(project.brief)}` : "",

    `## What this concept was trying to do
${conceptSummary(concept)}`,

    `## Standards
- Score each dimension 1–10 as an *observation*, not a ranking against sibling concepts.
- Be specific. "The counter in the symbol closes up below roughly 24px" is useful. "Good scalability" is not.
- Name real production problems: strokes too thin to survive embroidery, trapped negative space that fills in on press, near-tangent lines that will look like errors, insufficient optical spacing.
- If the rendered text is misspelled, malformed, or typographically amateur, say so plainly in the typography note. Image models routinely corrupt letterforms and this must be caught here.
- If the mark resembles an existing well-known logo, name the logo.
- Be honest about genericness. If this could belong to four hundred other companies, say that.
- You must NOT state which concept is best, recommend one for selection, or use language like "the strongest option". The human designer decides.`,

    JSON_DISCIPLINE,
  );
}

/**
 * Pre-finalist quality gate (spec §38). Deliberately phrased as a checklist so
 * the output reads as diligence, not as a verdict.
 */
export function buildQualityCheckPrompt(project: Project, concept: LogoConcept): string {
  return compose(
    `# Task
Run a production quality checklist against the attached logo before it is promoted to finalist. Answer each question honestly with pass / caution / fail.`,

    project.brief ? `## Brief\n${serializeBrief(project.brief)}` : "",
    `## Concept\n${conceptSummary(concept)}`,

    `## The checklist (answer every question, in this order)
1. Does the symbol still work with all colour removed?
2. Does it remain recognisable at 16 pixels?
3. Is the silhouette distinctive enough to identify without the wordmark?
4. Is it more complex than the idea requires?
5. Does it resemble a common logo cliche?
6. Does the typography hold up — correct spelling, sound letterforms, even spacing?
7. Is the optical spacing and balance correct?
8. Is the concept consistent with the approved brand brief?
9. Will it reproduce cleanly in one-colour print, embroidery, and engraving?
10. Are there any tangents, trapped shapes, or near-misses that read as mistakes?

Report findings only. Do not recommend whether to promote it — that is the designer's call.`,

    JSON_DISCIPLINE,
  );
}

/** Font recommendations for rebuilding a wordmark the image model mangled. */
export function buildFontRecommendationPrompt(
  project: Project,
  concept: LogoConcept,
): string {
  return compose(
    `# Task
The wordmark inside this generated logo cannot be trusted for production — image models corrupt letterforms. Recommend real typefaces the designer can use to reset the company name "${concept.typography.exactCompanyName}" so it sits correctly with this symbol.`,

    project.brief ? `## Brief\n${serializeBrief(project.brief)}` : "",
    `## The mark\n${conceptSummary(concept)}`,

    `## Standards
- Recommend 4–6 real, obtainable typefaces. Name the actual family — no invented names.
- Prefer families with genuine range (multiple weights, good numerals) since this becomes a brand system.
- At least two should be freely licensed so the client is not blocked on procurement.
- Explain the fit in terms of the mark's geometry, not in terms of mood.
- The wordmark notes must give concrete setting guidance: case, tracking in thousandths of an em, and which optical corrections this particular name needs.`,

    JSON_DISCIPLINE,
  );
}

export const CRITIQUE_SYSTEM = STUDIO_PERSONA;
