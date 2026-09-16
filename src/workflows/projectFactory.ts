import { SEED_QUESTIONS } from "@/prompts/discovery";
import type {
  ClientInfo,
  Project,
  StageId,
  StageState,
  TimelineEvent,
  TimelineKind,
} from "@/types";
import { STAGE_IDS } from "@/types";
import { newId, newShareToken } from "@/utils/id";

export interface NewProjectInput {
  companyName: string;
  industry: string;
  description: string;
  client?: Partial<ClientInfo>;
}

export function createProject(input: NewProjectInput): Project {
  const now = new Date().toISOString();
  const lockedStates = Object.fromEntries(
    STAGE_IDS.map((id) => [id, id === "discovery" ? "available" : "locked"]),
  ) as Record<StageId, StageState>;

  return {
    id: newId("proj"),
    companyName: input.companyName.trim(),
    industry: input.industry.trim(),
    description: input.description.trim(),
    status: "active",
    stage: "discovery",
    stageStates: lockedStates,

    client: {
      contactName: input.client?.contactName ?? "",
      company: input.client?.company ?? input.companyName.trim(),
      email: input.client?.email ?? "",
      notes: input.client?.notes ?? "",
    },

    discovery: {
      status: "not_started",
      questions: SEED_QUESTIONS.map((q, i) => ({
        ...q,
        id: newId("q"),
        order: i,
        // Pre-fill what we already know from the create form.
        answer:
          q.key === "company_name"
            ? input.companyName.trim()
            : q.key === "what_it_does" && input.description.trim()
              ? input.description.trim()
              : undefined,
        answeredAt:
          q.key === "company_name" || (q.key === "what_it_does" && input.description.trim())
            ? now
            : undefined,
      })),
      estimatedTotal: 12,
      additionalNotes: "",
    },

    briefEditedByUser: false,
    directions: [],
    concepts: [],
    feedbackMemory: { constraints: [] },
    finalistIds: [],

    clientReview: {
      shareToken: newShareToken(),
      published: false,
      presentationTitle: `${input.companyName.trim()} — Identity Concepts`,
      presentationIntro: "",
      conceptOrder: [],
      feedback: [],
      round: 0,
    },

    approvals: {
      designer: { approved: false },
      client: { approved: false },
      final: { approved: false },
    },

    timeline: [
      {
        id: newId("evt"),
        at: now,
        kind: "system",
        title: "Project created",
        detail: `${input.companyName.trim()}${input.industry ? ` — ${input.industry}` : ""}`,
      },
    ],

    generationSettings: {},
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export function timelineEvent(
  kind: TimelineKind,
  title: string,
  detail?: string,
  stage?: StageId,
  refs?: string[],
): TimelineEvent {
  return {
    id: newId("evt"),
    at: new Date().toISOString(),
    kind,
    stage,
    title,
    detail,
    refs,
  };
}

export function withEvent(project: Project, event: TimelineEvent): Project {
  return { ...project, timeline: [...project.timeline, event] };
}
