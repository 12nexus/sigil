import "server-only";
import {
  MAX_FEEDBACK_LENGTH,
  presentationOf,
  withClientFeedback,
  type FeedbackInput,
  type Presentation,
} from "@/features/present/presentation";
import type { ClientDecision, Project } from "@/types";
import { query } from "./db";
import { ConflictError, saveProject } from "./store";

/**
 * The public client link: /share/<token>. The token is the project's random share token
 * (128 bits), and the link only works while the presentation is published, so unpublishing
 * or issuing a new link turns the old one off. Nothing here returns the project itself:
 * callers get the client-safe presentation, its images, and a way to add feedback.
 */

const TOKEN = /^[A-Za-z0-9]{16,64}$/;
const DECISIONS: ClientDecision[] = ["approved", "changes_requested", "pending"];

async function sharedProject(token: string): Promise<{ project: Project; revision: number } | null> {
  if (!TOKEN.test(token)) return null;
  const rows = await query<{ data: Project; revision: number }>(
    `SELECT data, revision FROM projects
      WHERE data->'clientReview'->>'shareToken' = $1 AND status <> 'archived'`,
    [token],
  );
  const row = rows[0];
  if (!row || !row.data.clientReview?.published) return null;
  return { project: row.data, revision: row.revision };
}

export async function sharedPresentation(token: string): Promise<Presentation | null> {
  const found = await sharedProject(token);
  return found ? presentationOf(found.project) : null;
}

export class FeedbackRejectedError extends Error {}

/** Validate what a client posted. Throws FeedbackRejectedError with a message they can read. */
export function parseFeedback(value: unknown): FeedbackInput {
  const v = (value ?? {}) as Record<string, unknown>;
  const decision = v.decision as ClientDecision;
  if (!DECISIONS.includes(decision)) throw new FeedbackRejectedError("Unknown decision.");
  const body = typeof v.body === "string" ? v.body.trim() : "";
  if (body.length > MAX_FEEDBACK_LENGTH) {
    throw new FeedbackRejectedError(`Please keep feedback under ${MAX_FEEDBACK_LENGTH} characters.`);
  }
  if (decision !== "approved" && !body) throw new FeedbackRejectedError("Write a comment first.");
  const conceptId = typeof v.conceptId === "string" ? v.conceptId : undefined;
  return { conceptId, decision, body };
}

/** Add feedback to the shared project. Returns false if the link no longer works. */
export async function addSharedFeedback(token: string, input: FeedbackInput): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const found = await sharedProject(token);
    if (!found) return false;
    const shown = presentationOf(found.project).concepts.map((c) => c.id);
    if (input.conceptId && !shown.includes(input.conceptId)) {
      throw new FeedbackRejectedError("That concept is not in this presentation.");
    }
    try {
      // Saved against the revision just read, so a designer's save in between is never overwritten.
      await saveProject(withClientFeedback(found.project, input), found.revision);
      return true;
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
    }
  }
  throw new ConflictError("The project is busy. Please try again.");
}

/* ------------------------------------------------------------------ */
/* Abuse limit                                                         */
/* ------------------------------------------------------------------ */

const WINDOW_MS = 60 * 60 * 1000;
const PER_WINDOW = 30;
const recent = new Map<string, number[]>();

/** At most 30 feedback posts per link per hour: a public form must not be able to flood a project. */
export function allowFeedback(token: string): boolean {
  const now = Date.now();
  const times = (recent.get(token) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= PER_WINDOW) {
    recent.set(token, times);
    return false;
  }
  times.push(now);
  recent.set(token, times);
  if (recent.size > 1000) recent.delete(recent.keys().next().value!);
  return true;
}
