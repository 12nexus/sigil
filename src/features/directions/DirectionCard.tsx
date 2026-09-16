"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  MessageSquarePlus,
  Star,
  ThumbsDown,
  X,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Primitives";
import { EditableList, EditableText } from "@/features/brief/EditableValue";
import type { CreativeDirection } from "@/types";
import { formatRelative } from "@/utils/format";
import { cn } from "@/utils/cn";

export function DirectionCard({
  direction,
  onApprove,
  onReject,
  onReset,
  onFavorite,
  onComment,
  onEdit,
}: {
  direction: CreativeDirection;
  onApprove: () => void;
  onReject: () => void;
  onReset: () => void;
  onFavorite: () => void;
  onComment: (body: string) => void;
  onEdit: (patch: Partial<CreativeDirection>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [draft, setDraft] = useState("");

  const approved = direction.status === "approved";
  const rejected = direction.status === "rejected";

  const submitComment = () => {
    if (!draft.trim()) return;
    onComment(draft);
    setDraft("");
    setCommenting(false);
  };

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border bg-surface transition-all duration-200",
        approved
          ? "border-success/35 shadow-[0_0_0_1px_rgba(111,191,139,0.12)]"
          : rejected
            ? "border-line opacity-55"
            : "border-line hover:border-line-strong",
      )}
    >
      <div className="flex-1 p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="label-xs">Direction {direction.number}</span>
              {approved ? <Badge tone="success">Approved</Badge> : null}
              {rejected ? <Badge tone="danger">Rejected</Badge> : null}
              {direction.editedByUser ? <Badge tone="neutral">Edited</Badge> : null}
            </div>
            <h3 className="text-[17px] leading-snug text-ink">
              <EditableText
                value={direction.name}
                onSave={(name) => onEdit({ name })}
                className="!text-[17px]"
              />
            </h3>
          </div>
          <IconButton
            label={direction.favorite ? "Remove favourite" : "Mark as favourite"}
            tone="accent"
            active={direction.favorite}
            onClick={onFavorite}
          >
            <Star size={14} fill={direction.favorite ? "currentColor" : "none"} />
          </IconButton>
        </div>

        <EditableText
          multiline
          value={direction.summary}
          onSave={(summary) => onEdit({ summary })}
          className="!text-[13px] text-muted"
        />

        {/* Visual keywords double as the at-a-glance signature of the territory. */}
        <div className="mt-4">
          <p className="label-xs mb-2">Visual keywords</p>
          <EditableList
            tone="accent"
            items={direction.visualKeywords}
            onSave={(visualKeywords) => onEdit({ visualKeywords })}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label-xs mb-2">Strengths</p>
            <ul className="space-y-1">
              {direction.strengths.map((s, i) => (
                <li key={i} className="flex gap-1.5 text-[12px] leading-snug text-muted">
                  <Check size={11} className="mt-1 shrink-0 text-success" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label-xs mb-2">Risks</p>
            <ul className="space-y-1">
              {direction.risks.map((r, i) => (
                <li key={i} className="flex gap-1.5 text-[12px] leading-snug text-muted">
                  <AlertTriangle size={11} className="mt-1 shrink-0 text-caution" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 inline-flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-accent"
        >
          <ChevronDown
            size={12}
            className={cn("transition-transform", expanded && "rotate-180")}
          />
          {expanded ? "Less" : "Full territory brief"}
        </button>

        {expanded ? (
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            <Detail label="Core concept">
              <EditableText
                multiline
                value={direction.concept}
                onSave={(concept) => onEdit({ concept })}
              />
            </Detail>
            <Detail label="Visual principle">
              <EditableText
                multiline
                value={direction.visualPrinciple}
                onSave={(visualPrinciple) => onEdit({ visualPrinciple })}
              />
            </Detail>
            <Detail label="Why it fits this brand">
              <EditableText
                multiline
                value={direction.rationale}
                onSave={(rationale) => onEdit({ rationale })}
              />
            </Detail>
            <Detail label="Potential symbolism">
              <EditableList
                items={direction.symbolConcepts}
                onSave={(symbolConcepts) => onEdit({ symbolConcepts })}
              />
            </Detail>
            <Detail label="Typography">
              <EditableText
                multiline
                value={direction.typography}
                onSave={(typography) => onEdit({ typography })}
              />
            </Detail>
            <Detail label="Colour considerations">
              <EditableText
                multiline
                value={direction.colorApproach}
                onSave={(colorApproach) => onEdit({ colorApproach })}
              />
            </Detail>
            <Detail label="Differentiation from competitors">
              <EditableText
                multiline
                value={direction.differentiation}
                onSave={(differentiation) => onEdit({ differentiation })}
              />
            </Detail>
          </div>
        ) : null}

        {/* Comments — the reason a rejection teaches the AI anything. */}
        {direction.comments.length > 0 ? (
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            {direction.comments.map((comment) => (
              <div key={comment.id} className="rounded-lg bg-surface-2 px-3 py-2">
                <p className="text-[12px] leading-relaxed text-muted">{comment.body}</p>
                <p className="mt-1 text-[10px] text-faint">
                  {formatRelative(comment.createdAt)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {commenting ? (
          <div className="mt-4 space-y-2">
            <Textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Why does this work, or why does it not?"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment();
                if (e.key === "Escape") setCommenting(false);
              }}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={submitComment}>
                Add note
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCommenting(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Decision bar */}
      <footer className="flex items-center gap-2 border-t border-line px-4 py-3">
        {direction.status === "new" ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<Check size={13} />}
              onClick={onApprove}
              className="flex-1"
            >
              Approve
            </Button>
            <Button size="sm" variant="ghost" icon={<ThumbsDown size={13} />} onClick={onReject}>
              Reject
            </Button>
          </>
        ) : (
          <>
            <span
              className={cn(
                "flex-1 text-[12px]",
                approved ? "text-success" : "text-muted",
              )}
            >
              {approved ? "Approved for exploration" : "Rejected — remembered as a constraint"}
            </span>
            <Button size="sm" variant="ghost" icon={<X size={12} />} onClick={onReset}>
              Undo
            </Button>
          </>
        )}
        <IconButton label="Add a note" onClick={() => setCommenting((v) => !v)}>
          <MessageSquarePlus size={14} />
        </IconButton>
      </footer>
    </article>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-xs mb-1.5">{label}</p>
      {children}
    </div>
  );
}
