"use client";

import { useMemo, useState } from "react";
import {
  Columns3,
  GitBranch,
  Heart,
  ImageOff,
  ListChecks,
  ThumbsDown,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Primitives";
import { useLoadedProject } from "@/hooks/useProject";
import type { ConceptStatus, LogoConcept } from "@/types";
import { CONCEPT_STATUSES } from "@/types";
import {
  EMPTY_FILTER,
  filterConcepts,
  rateConcept,
  setConceptStatus,
  setConceptStatusBulk,
  SORTS,
  type ConceptFilter,
  type SortKey,
} from "@/workflows/mutations";
import { timelineEvent } from "@/workflows/projectFactory";
import { ConceptCard } from "./ConceptCard";
import { ConceptDetail } from "./ConceptDetail";
import { ConceptFilters } from "./ConceptFilters";
import { CompareModal } from "./CompareModal";

/**
 * The concept library.
 *
 * Shared by exploration, selection, and refinement so curation behaves
 * identically wherever the designer happens to be standing.
 */
export function ConceptLibrary({
  concepts,
  onIterate,
  emptyTitle = "No concepts yet",
  emptyDescription,
  emptyAction,
}: {
  concepts: LogoConcept[];
  onIterate?: (conceptId: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  const { project, update } = useLoadedProject();

  const [filter, setFilter] = useState<ConceptFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<SortKey>("code");
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  const counts = useMemo(() => {
    const result = Object.fromEntries(
      CONCEPT_STATUSES.map((s) => [s, 0]),
    ) as Record<ConceptStatus, number>;
    for (const concept of concepts) result[concept.status] += 1;
    return result;
  }, [concepts]);

  const visible = useMemo(
    () => [...filterConcepts(concepts, filter)].sort(SORTS[sort]),
    [concepts, filter, sort],
  );

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const bulk = async (status: ConceptStatus) => {
    await update(
      (p) => setConceptStatusBulk(p, selected, status),
      timelineEvent(
        "decision",
        `${selected.length} concept${selected.length === 1 ? "" : "s"} marked ${status}`,
        selected
          .map((id) => concepts.find((c) => c.id === id)?.code)
          .filter(Boolean)
          .join(", "),
        project.stage,
      ),
    );
    setSelected([]);
  };

  if (concepts.length === 0) {
    return (
      <EmptyState
        icon={<ImageOff size={26} />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="space-y-5">
      <ConceptFilters
        filter={filter}
        onChange={setFilter}
        directions={project.directions.filter((d) => d.status === "approved")}
        sort={sort}
        onSortChange={setSort}
        counts={counts}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-muted">
          {visible.length === concepts.length
            ? `${concepts.length} concept${concepts.length === 1 ? "" : "s"}`
            : `${visible.length} of ${concepts.length} concepts`}
        </p>
        <p className="hidden text-[11px] text-faint sm:block">
          ⌘-click a concept to select it
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing matches those filters"
          description="Rejected concepts are never deleted — clear the filters to see everything the project has generated."
          action={
            <Button variant="secondary" size="sm" onClick={() => setFilter(EMPTY_FILTER)}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {visible.map((concept) => (
            <ConceptCard
              key={concept.id}
              concept={concept}
              direction={project.directions.find((d) => d.id === concept.directionId)}
              selected={selected.includes(concept.id)}
              onSelect={toggleSelect}
              onOpen={setDetailId}
              onIterate={onIterate}
              onStatus={(id, status) =>
                update(
                  (p) => setConceptStatus(p, id, status),
                  timelineEvent(
                    "decision",
                    `${concepts.find((c) => c.id === id)?.code} marked ${status}`,
                    undefined,
                    project.stage,
                  ),
                )
              }
              onRate={(id, rating) => update((p) => rateConcept(p, id, rating), null)}
            />
          ))}
        </div>
      )}

      {/* Bulk action bar — appears only when something is selected. */}
      {selected.length > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 w-[min(760px,calc(100vw-3rem))] -translate-x-1/2 animate-rise">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-strong bg-surface-2/95 px-4 py-3 shadow-panel backdrop-blur-xl">
            <span className="text-[12px] text-ink">
              {selected.length} selected
            </span>
            <span className="mx-1 h-4 w-px bg-line" />

            <Button size="sm" variant="ghost" icon={<Heart size={13} />} onClick={() => bulk("favorite")}>
              Favourite
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<ListChecks size={13} />}
              onClick={() => bulk("shortlisted")}
            >
              Shortlist
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trophy size={13} />}
              onClick={() => bulk("finalist")}
            >
              Finalist
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<ThumbsDown size={13} />}
              onClick={() => bulk("rejected")}
            >
              Reject
            </Button>

            {selected.length >= 2 && selected.length <= 5 ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<Columns3 size={13} />}
                onClick={() => setComparing(true)}
              >
                Compare
              </Button>
            ) : null}

            {selected.length === 1 && onIterate ? (
              <Button
                size="sm"
                variant="accent"
                icon={<GitBranch size={13} />}
                onClick={() => {
                  onIterate(selected[0]);
                  setSelected([]);
                }}
              >
                Generate variations
              </Button>
            ) : null}

            <Button
              size="sm"
              variant="ghost"
              icon={<X size={13} />}
              onClick={() => setSelected([])}
              className="ml-auto"
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {detailId ? (
        <ConceptDetail
          conceptId={detailId}
          onClose={() => setDetailId(null)}
          onIterate={
            onIterate
              ? (id) => {
                  setDetailId(null);
                  onIterate(id);
                }
              : undefined
          }
          onNavigate={setDetailId}
        />
      ) : null}

      {comparing ? (
        <CompareModal conceptIds={selected} onClose={() => setComparing(false)} />
      ) : null}
    </div>
  );
}
