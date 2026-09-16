import type {
  Comment,
  ConceptStatus,
  Constraint,
  ConstraintPolarity,
  CreativeDirection,
  DirectionStatus,
  LogoConcept,
  Project,
} from "@/types";
import { newId } from "@/utils/id";

/**
 * Pure project mutations.
 *
 * Every one of these returns a new project; none of them ever delete generated
 * work. Rejection is a status change, not a removal, so the full design history
 * stays recoverable and the AI can learn from what was turned down.
 */

/* ------------------------------ Comments ---------------------------- */

export function makeComment(
  body: string,
  author: Comment["author"] = "designer",
  authorName?: string,
): Comment {
  return {
    id: newId("cmt"),
    author,
    authorName,
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };
}

/* ---------------------------- Constraints --------------------------- */

export function makeConstraint(
  polarity: ConstraintPolarity,
  text: string,
  source: Constraint["source"],
  origin: string,
): Constraint {
  return {
    id: newId("con"),
    polarity,
    text: text.trim(),
    source,
    origin,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export function addConstraints(project: Project, constraints: Constraint[]): Project {
  const existing = new Set(
    project.feedbackMemory.constraints.map((c) => `${c.polarity}:${c.text.toLowerCase()}`),
  );
  const fresh = constraints.filter(
    (c) => !existing.has(`${c.polarity}:${c.text.toLowerCase()}`),
  );
  if (!fresh.length) return project;
  return {
    ...project,
    feedbackMemory: {
      constraints: [...project.feedbackMemory.constraints, ...fresh],
    },
  };
}

export function toggleConstraint(project: Project, constraintId: string): Project {
  return {
    ...project,
    feedbackMemory: {
      constraints: project.feedbackMemory.constraints.map((c) =>
        c.id === constraintId ? { ...c, active: !c.active } : c,
      ),
    },
  };
}

export function removeConstraint(project: Project, constraintId: string): Project {
  return {
    ...project,
    feedbackMemory: {
      constraints: project.feedbackMemory.constraints.filter((c) => c.id !== constraintId),
    },
  };
}

/* ----------------------------- Directions --------------------------- */

export function setDirectionStatus(
  project: Project,
  directionId: string,
  status: DirectionStatus,
): Project {
  const direction = project.directions.find((d) => d.id === directionId);
  let next: Project = {
    ...project,
    directions: project.directions.map((d) =>
      d.id === directionId ? { ...d, status } : d,
    ),
  };

  // A rejected territory becomes a durable negative constraint, so later
  // generations stop wandering back into it.
  if (status === "rejected" && direction) {
    next = addConstraints(next, [
      makeConstraint(
        "negative",
        `Avoid the "${direction.name}" territory: ${direction.summary}`,
        "rejection",
        `Rejected direction ${direction.number}`,
      ),
    ]);
  }
  return next;
}

export function toggleDirectionFavorite(project: Project, directionId: string): Project {
  return {
    ...project,
    directions: project.directions.map((d) =>
      d.id === directionId ? { ...d, favorite: !d.favorite } : d,
    ),
  };
}

export function updateDirection(
  project: Project,
  directionId: string,
  patch: Partial<CreativeDirection>,
): Project {
  return {
    ...project,
    directions: project.directions.map((d) =>
      d.id === directionId ? { ...d, ...patch, editedByUser: true } : d,
    ),
  };
}

export function commentOnDirection(
  project: Project,
  directionId: string,
  comment: Comment,
): Project {
  return {
    ...project,
    directions: project.directions.map((d) =>
      d.id === directionId ? { ...d, comments: [...d.comments, comment] } : d,
    ),
  };
}

/* ------------------------------ Concepts ---------------------------- */

export function updateConcept(
  project: Project,
  conceptId: string,
  patch: Partial<LogoConcept> | ((concept: LogoConcept) => Partial<LogoConcept>),
): Project {
  return {
    ...project,
    concepts: project.concepts.map((c) =>
      c.id === conceptId
        ? {
            ...c,
            ...(typeof patch === "function" ? patch(c) : patch),
            updatedAt: new Date().toISOString(),
          }
        : c,
    ),
  };
}

export function setConceptStatus(
  project: Project,
  conceptId: string,
  status: ConceptStatus,
): Project {
  let next = updateConcept(project, conceptId, { status });

  // Finalist membership is kept as an explicit ordered list.
  if (status === "finalist" && !next.finalistIds.includes(conceptId)) {
    next = { ...next, finalistIds: [...next.finalistIds, conceptId] };
  }
  if (status !== "finalist" && status !== "approved") {
    next = { ...next, finalistIds: next.finalistIds.filter((id) => id !== conceptId) };
  }
  return next;
}

export function setConceptStatusBulk(
  project: Project,
  conceptIds: string[],
  status: ConceptStatus,
): Project {
  return conceptIds.reduce((acc, id) => setConceptStatus(acc, id, status), project);
}

export function rateConcept(project: Project, conceptId: string, rating: number): Project {
  return updateConcept(project, conceptId, (c) => ({
    rating: c.rating === rating ? 0 : rating,
  }));
}

export function commentOnConcept(
  project: Project,
  conceptId: string,
  comment: Comment,
): Project {
  return updateConcept(project, conceptId, (c) => ({
    comments: [...c.comments, comment],
  }));
}

export function toggleClientVisible(project: Project, conceptId: string): Project {
  return updateConcept(project, conceptId, (c) => ({ clientVisible: !c.clientVisible }));
}

/* ------------------------------ Lineage ----------------------------- */

/** Direct children of a concept. */
export function childrenOf(project: Project, conceptId: string): LogoConcept[] {
  return project.concepts.filter((c) => c.parentConceptId === conceptId);
}

/** Root-to-leaf tree for the version tree view. */
export interface ConceptNode {
  concept: LogoConcept;
  children: ConceptNode[];
}

export function buildConceptTree(concepts: LogoConcept[]): ConceptNode[] {
  const byId = new Map(concepts.map((c) => [c.id, { concept: c, children: [] as ConceptNode[] }]));
  const roots: ConceptNode[] = [];

  for (const node of byId.values()) {
    const parentId = node.concept.parentConceptId;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortTree = (nodes: ConceptNode[]) => {
    nodes.sort((a, b) => a.concept.code.localeCompare(b.concept.code, undefined, { numeric: true }));
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);
  return roots;
}

/* ---------------------------- Finalists ----------------------------- */

export function reorderFinalists(project: Project, orderedIds: string[]): Project {
  return { ...project, finalistIds: orderedIds };
}

/* ------------------------------ Search ------------------------------ */

export interface ConceptFilter {
  query: string;
  directionIds: string[];
  statuses: ConceptStatus[];
  minRating: number;
  iterationsOnly: boolean;
  originalsOnly: boolean;
}

export const EMPTY_FILTER: ConceptFilter = {
  query: "",
  directionIds: [],
  statuses: [],
  minRating: 0,
  iterationsOnly: false,
  originalsOnly: false,
};

export function filterConcepts(
  concepts: LogoConcept[],
  filter: ConceptFilter,
): LogoConcept[] {
  const query = filter.query.trim().toLowerCase();

  return concepts.filter((c) => {
    if (filter.statuses.length && !filter.statuses.includes(c.status)) return false;
    if (filter.directionIds.length && !filter.directionIds.includes(c.directionId)) return false;
    if (filter.minRating > 0 && c.rating < filter.minRating) return false;
    if (filter.iterationsOnly && c.iterationNumber === 0) return false;
    if (filter.originalsOnly && c.iterationNumber > 0) return false;

    if (query) {
      const haystack = [
        c.code,
        c.name,
        c.description,
        c.objective,
        c.rationale,
        c.notes,
        ...c.comments.map((x) => x.body),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export const SORTS = {
  newest: (a: LogoConcept, b: LogoConcept) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a: LogoConcept, b: LogoConcept) => a.createdAt.localeCompare(b.createdAt),
  code: (a: LogoConcept, b: LogoConcept) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  rating: (a: LogoConcept, b: LogoConcept) => b.rating - a.rating || SORTS.code(a, b),
} as const;

export type SortKey = keyof typeof SORTS;
