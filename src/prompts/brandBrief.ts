import type { BrandBrief, Project } from "@/types";
import {
  JSON_DISCIPLINE,
  STUDIO_PERSONA,
  compose,
  serializeBrief,
  serializeDiscovery,
} from "./shared";

export function buildBrandBriefPrompt(project: Project): string {
  return compose(
    `# Task
Synthesise the discovery interview into a complete, professional brand brief. This document governs every subsequent design decision, so it must be specific enough to design against and to critique against.`,

    `## Discovery interview
${serializeDiscovery(project.discovery.questions, project.discovery.additionalNotes)}`,

    `## Standards
- Be specific to this company. A brief that could be pasted into another company's project has failed.
- Infer intelligently where the designer was vague, but never invent facts (funding, size, history, named clients).
- Where the designer skipped a question, make a reasoned professional recommendation rather than leaving a gap.
- "Avoid" is the most useful section in the document. Name the actual cliches this industry produces — be concrete and unsparing.
- The competitive landscape entry must describe how competitors genuinely look (colour, form, typography) and where the open visual territory is.
- The strategic summary is the single paragraph you would read aloud before presenting work. Make it earn its place.`,

    JSON_DISCIPLINE,
  );
}

/** Used when the designer edits the brief and wants it re-checked for coherence. */
export function buildBriefReviewPrompt(brief: BrandBrief): string {
  return compose(
    `# Task
The designer has edited this brand brief. Identify any internal contradictions, vague statements that cannot be designed against, or gaps that would cause problems later. Be direct and brief.`,
    `## Brief\n${serializeBrief(brief)}`,
  );
}

export const BRAND_BRIEF_SYSTEM = STUDIO_PERSONA;
