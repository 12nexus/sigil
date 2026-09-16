import type { Project, StageId, StageMeta, StageState } from "@/types";
import { STAGE_IDS } from "@/types";

/**
 * The ten stages.
 *
 * Gating is derived, never stored as truth: `computeStageStates` recomputes
 * everything from project data on every render. That is what makes navigating
 * backwards safe — nothing is destroyed by revisiting an earlier stage, and
 * later stages simply recompute their own availability.
 */
export const STAGES: StageMeta[] = [
  {
    id: "discovery",
    index: 0,
    label: "Discovery",
    shortLabel: "Discovery",
    purpose: "An adaptive interview that establishes what this brand actually is.",
    decision: "Answer enough questions for a defensible brief.",
    requires: [],
  },
  {
    id: "brief",
    index: 1,
    label: "Brand Brief",
    shortLabel: "Brief",
    purpose: "Discovery synthesised into the strategic document everything is designed against.",
    decision: "Edit and approve the brief.",
    requires: ["discovery"],
  },
  {
    id: "directions",
    index: 2,
    label: "Creative Directions",
    shortLabel: "Directions",
    purpose: "Fundamentally different creative territories, before any artwork exists.",
    decision: "Approve the territories worth exploring; reject the rest.",
    requires: ["brief"],
  },
  {
    id: "exploration",
    index: 3,
    label: "Logo Exploration",
    shortLabel: "Exploration",
    purpose: "Broad generation of conceptually distinct marks inside the approved territories.",
    decision: "Let the batch run, then review what came back.",
    requires: ["directions"],
  },
  {
    id: "selection",
    index: 4,
    label: "Concept Selection",
    shortLabel: "Selection",
    purpose: "Human curation of the full concept library.",
    decision: "Shortlist the concepts worth developing.",
    requires: ["exploration"],
  },
  {
    id: "refinement",
    index: 5,
    label: "Refinement",
    shortLabel: "Refinement",
    purpose: "Directed iteration on shortlisted concepts using your feedback.",
    decision: "Give feedback, generate variations, keep narrowing.",
    requires: ["selection"],
  },
  {
    id: "finalists",
    index: 6,
    label: "Finalists",
    shortLabel: "Finalists",
    purpose: "Two to four developed concepts with full lockup families.",
    decision: "Promote finalists and build out their lockups.",
    requires: ["refinement"],
  },
  {
    id: "client-review",
    index: 7,
    label: "Client Review",
    shortLabel: "Client",
    purpose: "A polished presentation for the client, and their feedback interpreted.",
    decision: "Publish the presentation; approve the reading of their feedback.",
    requires: ["finalists"],
  },
  {
    id: "finalization",
    index: 8,
    label: "Finalization",
    shortLabel: "Final",
    purpose: "The approved mark built out into a complete logo system.",
    decision: "Give final approval and set the finalization options.",
    requires: ["client-review"],
  },
  {
    id: "delivery",
    index: 9,
    label: "Delivery",
    shortLabel: "Delivery",
    purpose: "Brand kit, asset package, and client-ready exports.",
    decision: "Export and hand off.",
    requires: ["finalization"],
  },
];

export const STAGE_BY_ID: Record<StageId, StageMeta> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
) as Record<StageId, StageMeta>;

export function stageIndex(id: StageId): number {
  return STAGE_BY_ID[id].index;
}

/* ------------------------------------------------------------------ */
/* Completion rules                                                    */
/* ------------------------------------------------------------------ */

/** Has the human finished their part of this stage? */
export function isStageComplete(project: Project, id: StageId): boolean {
  switch (id) {
    case "discovery":
      return project.discovery.status === "complete";
    case "brief":
      return Boolean(project.briefApprovedAt);
    case "directions":
      return project.directions.some((d) => d.status === "approved");
    case "exploration":
      return project.concepts.some((c) => c.iterationNumber === 0 && !c.error);
    case "selection":
      return project.concepts.some(
        (c) => c.status === "shortlisted" || c.status === "finalist" || c.status === "approved",
      );
    case "refinement":
      // Complete once the designer has either iterated or explicitly moved on
      // by promoting a finalist.
      return project.finalistIds.length > 0;
    case "finalists":
      return project.finalistIds.length > 0 && project.approvals.designer.approved;
    case "client-review":
      return project.approvals.client.approved;
    case "finalization":
      return project.approvals.final.approved && Boolean(project.finalization?.confirmedAt);
    case "delivery":
      return Boolean(project.brandKit);
  }
}

/** Is the stage waiting on a human decision right now? */
export function isAwaitingReview(project: Project, id: StageId): boolean {
  switch (id) {
    case "discovery":
      return project.discovery.status === "sufficient";
    case "brief":
      return Boolean(project.brief) && !project.briefApprovedAt;
    case "directions":
      return project.directions.length > 0 && project.directions.every((d) => d.status === "new");
    case "exploration":
      return project.concepts.some((c) => c.status === "new" && !c.error);
    case "selection":
      return (
        project.concepts.filter((c) => c.status === "shortlisted").length > 0 &&
        project.finalistIds.length === 0
      );
    case "refinement":
      return project.concepts.some((c) => c.status === "shortlisted") && project.finalistIds.length === 0;
    case "finalists":
      return project.finalistIds.length > 0 && !project.approvals.designer.approved;
    case "client-review":
      return project.clientReview.feedback.some(
        (f) => f.interpretationStatus === "pending_review",
      );
    case "finalization":
      return project.approvals.client.approved && !project.approvals.final.approved;
    case "delivery":
      return project.approvals.final.approved && !project.brandKit;
  }
}

/**
 * A stage unlocks when its prerequisites are complete. Completed stages stay
 * reachable forever so the designer can go back and change their mind.
 */
export function computeStageStates(project: Project): Record<StageId, StageState> {
  const states = {} as Record<StageId, StageState>;

  for (const stage of STAGES) {
    const prerequisitesMet = stage.requires.every((r) => isStageComplete(project, r));
    if (!prerequisitesMet) {
      states[stage.id] = "locked";
      continue;
    }
    if (isStageComplete(project, stage.id)) {
      states[stage.id] = "complete";
    } else if (isAwaitingReview(project, stage.id)) {
      states[stage.id] = "awaiting_review";
    } else if (hasStarted(project, stage.id)) {
      states[stage.id] = "in_progress";
    } else {
      states[stage.id] = "available";
    }
  }
  return states;
}

function hasStarted(project: Project, id: StageId): boolean {
  switch (id) {
    case "discovery":
      return project.discovery.status !== "not_started";
    case "brief":
      return Boolean(project.brief);
    case "directions":
      return project.directions.length > 0;
    case "exploration":
      return project.concepts.length > 0;
    case "selection":
      return project.concepts.some((c) => c.status !== "new");
    case "refinement":
      return project.concepts.some((c) => c.iterationNumber > 0);
    case "finalists":
      return project.finalistIds.length > 0;
    case "client-review":
      return project.clientReview.published || project.clientReview.feedback.length > 0;
    case "finalization":
      return Boolean(project.finalization);
    case "delivery":
      return Boolean(project.brandKit);
  }
}

export function canEnterStage(project: Project, id: StageId): boolean {
  return computeStageStates(project)[id] !== "locked";
}

/** 0..1 across the ten stages, used by the dashboard progress indicator. */
export function stageProgress(project: Project): number {
  const complete = STAGE_IDS.filter((id) => isStageComplete(project, id)).length;
  return complete / STAGE_IDS.length;
}

/** The stage the designer should most plausibly be working in. */
export function suggestedStage(project: Project): StageId {
  const states = computeStageStates(project);
  const awaiting = STAGES.find((s) => states[s.id] === "awaiting_review");
  if (awaiting) return awaiting.id;
  const firstIncomplete = STAGES.find(
    (s) => states[s.id] !== "complete" && states[s.id] !== "locked",
  );
  return firstIncomplete?.id ?? "delivery";
}

export const STAGE_STATE_LABEL: Record<StageState, string> = {
  locked: "Locked",
  available: "Ready",
  in_progress: "In progress",
  awaiting_review: "Needs your decision",
  complete: "Complete",
};
