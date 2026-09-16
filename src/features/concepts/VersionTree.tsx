"use client";

import { ConceptImage } from "@/components/ConceptImage";
import { Badge } from "@/components/ui/Primitives";
import type { CreativeDirection, LogoConcept } from "@/types";
import { buildConceptTree, type ConceptNode } from "@/workflows/mutations";
import { cn } from "@/utils/cn";

/**
 * Version tree (spec §39).
 *
 * Makes provenance visible: every refined mark can be traced back to the
 * original exploration concept it came from, and every dead end stays on the
 * tree rather than disappearing.
 */
export function VersionTree({
  concepts,
  directions,
  onOpen,
  selectedId,
}: {
  concepts: LogoConcept[];
  directions: CreativeDirection[];
  onOpen: (id: string) => void;
  selectedId?: string;
}) {
  const roots = buildConceptTree(concepts);

  const byDirection = directions
    .map((direction) => ({
      direction,
      nodes: roots.filter((n) => n.concept.directionId === direction.id),
    }))
    .filter((group) => group.nodes.length > 0);

  const orphans = roots.filter(
    (n) => !directions.some((d) => d.id === n.concept.directionId),
  );

  if (!roots.length) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-[12px] text-muted">
        Nothing generated yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {byDirection.map(({ direction, nodes }) => (
        <section key={direction.id}>
          <h3 className="mb-3 flex items-center gap-2 text-[13px] text-ink">
            <span className="label-xs">Direction {direction.number}</span>
            {direction.name}
          </h3>
          <div className="space-y-3">
            {nodes.map((node) => (
              <TreeBranch key={node.concept.id} node={node} onOpen={onOpen} selectedId={selectedId} />
            ))}
          </div>
        </section>
      ))}

      {orphans.length > 0 ? (
        <section>
          <h3 className="mb-3 text-[13px] text-ink">Other concepts</h3>
          <div className="space-y-3">
            {orphans.map((node) => (
              <TreeBranch key={node.concept.id} node={node} onOpen={onOpen} selectedId={selectedId} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TreeBranch({
  node,
  onOpen,
  selectedId,
  depth = 0,
}: {
  node: ConceptNode;
  onOpen: (id: string) => void;
  selectedId?: string;
  depth?: number;
}) {
  return (
    <div className={cn(depth > 0 && "ml-6 border-l border-line pl-5")}>
      <TreeNode concept={node.concept} onOpen={onOpen} selected={selectedId === node.concept.id} />
      {node.children.length > 0 ? (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <TreeBranch
              key={child.concept.id}
              node={child}
              onOpen={onOpen}
              selectedId={selectedId}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TreeNode({
  concept,
  onOpen,
  selected,
}: {
  concept: LogoConcept;
  onOpen: (id: string) => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(concept.id)}
      className={cn(
        "relative flex w-full max-w-xl items-center gap-3 rounded-lg border bg-surface p-2 text-left transition-colors",
        selected ? "border-accent" : "border-line hover:border-line-strong",
        concept.status === "rejected" && "opacity-50",
      )}
    >
      <ConceptImage
        assetId={concept.primaryAssetId}
        alt={concept.name}
        className="h-12 w-12 shrink-0"
        imgClassName="p-1"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-faint">{concept.code}</span>
          <span className="truncate text-[12px] text-ink">{concept.name}</span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-faint">{concept.objective}</span>
      </span>
      {concept.status !== "new" ? (
        <Badge
          tone={
            concept.status === "rejected"
              ? "danger"
              : concept.status === "finalist" || concept.status === "approved"
                ? "success"
                : "accent"
          }
        >
          {concept.status}
        </Badge>
      ) : null}
    </button>
  );
}
