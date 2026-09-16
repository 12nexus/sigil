import type { ClientFeedbackEntry, LogoConcept, Project } from "@/types";
import {
  JSON_DISCIPLINE,
  STUDIO_PERSONA,
  compose,
  conceptSummary,
  serializeBrief,
} from "./shared";

/**
 * Clients speak in feelings ("too aggressive", "feels cold"). This translates
 * that into design requirements — and surfaces what it could NOT resolve, so
 * the designer confirms the reading before anything is generated.
 */
export function buildClientFeedbackPrompt(
  project: Project,
  entry: ClientFeedbackEntry,
  concept?: LogoConcept,
): string {
  return compose(
    `# Task
Interpret a client's feedback on presented logo work and convert it into structured design requirements the studio can act on.`,

    concept ? `## The concept the client was responding to\n${conceptSummary(concept)}` : "## The client commented on the presentation as a whole",

    `## The client's feedback (verbatim)
"${entry.body}"

Their stated decision: ${entry.decision === "approved" ? "APPROVED" : entry.decision === "changes_requested" ? "CHANGES REQUESTED" : "no decision recorded"}`,

    project.brief ? `## The approved brand brief\n${serializeBrief(project.brief)}` : "",

    `## Standards
- Translate feeling into form. "Too aggressive" is not a design instruction; "reduce the acuteness of the angles and increase corner radius" is.
- Distinguish carefully between what the client wants preserved and what they want changed. Getting this wrong destroys work they already approved.
- Do not over-interpret. If the client said one thing, do not manufacture five requirements from it.
- Put anything genuinely ambiguous in the ambiguities array rather than guessing. The designer will resolve it with the client. This field is the most valuable output when the feedback is vague.
- If the client's request conflicts with the approved brand brief, say so explicitly in suggestedActions — the designer needs to know before they execute it.
- Never soften or editorialise the client's criticism.`,

    JSON_DISCIPLINE,
  );
}

export const CLIENT_FEEDBACK_SYSTEM = STUDIO_PERSONA;
