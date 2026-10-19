import { MOCKUP_SURFACE_BY_ID } from "@/prompts/mockups";
import { currentMockups } from "@/features/mockups/current";
import type { ClientDecision, ClientFeedbackEntry, LockupKind, LogoConcept, MockupSurface, Project } from "@/types";
import { newId } from "@/utils/id";

/**
 * What the client is shown: a projection of the project with only the work and the thinking
 * behind it. Concept codes, ratings, critiques, prompts, rejected concepts, model names and the
 * designer's notes are not in it, so the public share link can be served from this alone.
 * Used by the server (share routes) and the browser (signed-in preview) alike.
 */

export interface PresentedConcept {
  id: string;
  name: string;
  rationale: string;
  primaryAssetId?: string;
  lockups: Array<{ kind: LockupKind; assetId: string }>;
  /** The logo on real surfaces, made from the current artwork only. */
  mockups: Array<{ surface: MockupSurface; label: string; assetId: string }>;
}

export interface Presentation {
  title: string;
  intro: string;
  published: boolean;
  concepts: PresentedConcept[];
}

export function presentationOf(project: Project): Presentation {
  const order = project.clientReview.conceptOrder.length
    ? project.clientReview.conceptOrder
    : project.finalistIds;
  const concepts = order
    .map((id) => project.concepts.find((c) => c.id === id))
    .filter((c): c is LogoConcept => c !== undefined && c.clientVisible)
    .map((c) => ({
      id: c.id,
      name: c.name,
      rationale: c.rationale,
      primaryAssetId: c.primaryAssetId,
      lockups: c.assets
        .filter((a) => a.kind !== "primary")
        .slice(0, 8)
        .map((a) => ({ kind: a.kind, assetId: a.assetId })),
      mockups: currentMockups(c).map((m) => ({
        surface: m.surface,
        label: MOCKUP_SURFACE_BY_ID[m.surface]?.label ?? m.surface,
        assetId: m.assetId,
      })),
    }));

  return {
    title: project.clientReview.presentationTitle,
    intro: project.clientReview.presentationIntro,
    published: project.clientReview.published,
    concepts,
  };
}

/** Every image the presentation shows: the only assets the share link may serve. */
export function presentationAssetIds(presentation: Presentation): Set<string> {
  const ids = new Set<string>();
  for (const c of presentation.concepts) {
    if (c.primaryAssetId) ids.add(c.primaryAssetId);
    for (const l of c.lockups) ids.add(l.assetId);
    for (const m of c.mockups) ids.add(m.assetId);
  }
  return ids;
}

export interface FeedbackInput {
  conceptId?: string;
  decision: ClientDecision;
  body: string;
}

export const MAX_FEEDBACK_LENGTH = 5000;

/** The project with the client's feedback and its timeline entry added. */
export function withClientFeedback(project: Project, input: FeedbackInput): Project {
  const entry: ClientFeedbackEntry = {
    id: newId("fb"),
    conceptId: input.conceptId,
    decision: input.decision,
    body: input.body.trim() || "Approved as presented.",
    submittedAt: new Date().toISOString(),
    interpretationStatus: "none",
  };
  return {
    ...project,
    clientReview: {
      ...project.clientReview,
      feedback: [...project.clientReview.feedback, entry],
    },
    timeline: [
      ...project.timeline,
      {
        id: newId("evt"),
        at: entry.submittedAt,
        kind: "client",
        stage: "client-review",
        title:
          input.decision === "approved"
            ? "Client approved a concept"
            : input.decision === "changes_requested"
              ? "Client requested changes"
              : "Client left a comment",
        detail: entry.body.slice(0, 160),
      },
    ],
  };
}
