"use client";

import {
  GitBranch,
  Heart,
  ListChecks,
  Star,
  ThumbsDown,
  Trophy,
} from "lucide-react";
import { ConceptImage } from "@/components/ConceptImage";
import { IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Primitives";
import type { ConceptStatus, CreativeDirection, LogoConcept } from "@/types";
import { cn } from "@/utils/cn";

const STATUS_TONE: Record<ConceptStatus, Parameters<typeof Badge>[0]["tone"]> = {
  new: "neutral",
  favorite: "accent",
  shortlisted: "violet",
  finalist: "success",
  approved: "success",
  rejected: "danger",
  archived: "neutral",
};

export function ConceptCard({
  concept,
  direction,
  selected,
  selectable = true,
  onSelect,
  onOpen,
  onStatus,
  onRate,
  onIterate,
}: {
  concept: LogoConcept;
  direction?: CreativeDirection;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: (id: string, additive: boolean) => void;
  onOpen: (id: string) => void;
  onStatus: (id: string, status: ConceptStatus) => void;
  onRate: (id: string, rating: number) => void;
  onIterate?: (id: string) => void;
}) {
  const rejected = concept.status === "rejected";

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-surface transition-all duration-200",
        selected
          ? "border-accent shadow-[0_0_0_1px_rgba(221,184,118,0.5)]"
          : "border-line hover:border-line-strong hover:shadow-lift",
        rejected && "opacity-45 hover:opacity-80",
      )}
    >
      {/* Artwork is the focus — everything else is chrome around it. */}
      <button
        type="button"
        onClick={(e) => {
          if (selectable && (e.metaKey || e.ctrlKey || e.shiftKey)) {
            onSelect?.(concept.id, true);
          } else {
            onOpen(concept.id);
          }
        }}
        className="relative block w-full focus-visible:outline-none"
        aria-label={`Open ${concept.code} ${concept.name}`}
      >
        <ConceptImage
          assetId={concept.primaryAssetId}
          alt={`${concept.code} — ${concept.name}`}
          className="rounded-none border-b border-line"
          imgClassName="p-4 transition-transform duration-500 group-hover:scale-[1.04]"
          padded={false}
        />

        <span className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-void/75 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink backdrop-blur-sm">
            {concept.code}
          </span>
          {concept.iterationNumber > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-void/75 px-1.5 py-0.5 text-[10px] text-violet backdrop-blur-sm">
              <GitBranch size={9} />v{concept.iterationNumber}
            </span>
          ) : null}
        </span>

        {concept.status !== "new" ? (
          <span className="absolute right-2.5 top-2.5">
            <Badge tone={STATUS_TONE[concept.status]}>{concept.status}</Badge>
          </span>
        ) : null}

        {selectable ? (
          <span
            role="checkbox"
            aria-checked={Boolean(selected)}
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(concept.id, true);
            }}
            className={cn(
              "absolute bottom-2.5 left-2.5 flex h-5 w-5 items-center justify-center rounded border transition-all",
              selected
                ? "border-accent bg-accent text-void opacity-100"
                : "border-white/30 bg-void/60 opacity-0 backdrop-blur-sm group-hover:opacity-100",
            )}
          >
            {selected ? <ListChecks size={11} /> : null}
          </span>
        ) : null}
      </button>

      <div className="flex flex-1 flex-col p-3">
        <button
          type="button"
          onClick={() => onOpen(concept.id)}
          className="text-left focus-visible:outline-none"
        >
          <h3 className="truncate text-[13px] leading-snug text-ink">{concept.name}</h3>
          <p className="mt-0.5 truncate text-[11px] text-faint">
            {direction ? `${direction.number}. ${direction.name}` : "—"}
          </p>
        </button>

        <div className="mt-3 flex items-center justify-between gap-1">
          {/* Rating */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Rate ${n} of 5`}
                onClick={() => onRate(concept.id, n)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  size={11}
                  className={cn(
                    n <= concept.rating ? "text-accent" : "text-faint/40 hover:text-faint",
                  )}
                  fill={n <= concept.rating ? "currentColor" : "none"}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5">
            <IconButton
              label="Favourite"
              tone="accent"
              active={concept.status === "favorite"}
              onClick={() =>
                onStatus(concept.id, concept.status === "favorite" ? "new" : "favorite")
              }
              className="h-7 w-7"
            >
              <Heart size={13} fill={concept.status === "favorite" ? "currentColor" : "none"} />
            </IconButton>
            <IconButton
              label="Shortlist"
              tone="default"
              active={concept.status === "shortlisted"}
              onClick={() =>
                onStatus(concept.id, concept.status === "shortlisted" ? "new" : "shortlisted")
              }
              className="h-7 w-7"
            >
              <ListChecks size={13} />
            </IconButton>
            {onIterate ? (
              <IconButton
                label="Generate variations"
                onClick={() => onIterate(concept.id)}
                className="h-7 w-7"
              >
                <GitBranch size={13} />
              </IconButton>
            ) : null}
            <IconButton
              label={rejected ? "Restore" : "Reject"}
              tone="danger"
              active={rejected}
              onClick={() => onStatus(concept.id, rejected ? "new" : "rejected")}
              className="h-7 w-7"
            >
              <ThumbsDown size={13} />
            </IconButton>
          </div>
        </div>

        {concept.status === "finalist" || concept.status === "approved" ? (
          <p className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-[10px] uppercase tracking-[0.1em] text-success">
            <Trophy size={10} />
            {concept.status === "approved" ? "Approved mark" : "Finalist"}
          </p>
        ) : null}
      </div>
    </article>
  );
}
