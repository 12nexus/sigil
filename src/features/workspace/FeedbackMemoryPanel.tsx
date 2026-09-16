"use client";

import { useState } from "react";
import { Brain, Minus, Plus, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useProject } from "@/hooks/useProject";
import {
  addConstraints,
  makeConstraint,
  removeConstraint,
  toggleConstraint,
} from "@/workflows/mutations";
import { cn } from "@/utils/cn";

/**
 * Feedback memory (spec §17).
 *
 * Constraints accumulate from rejections, designer notes, and client feedback,
 * and are injected into every downstream generation prompt. Keeping them
 * visible — and switchable — is what stops the AI repeating mistakes while
 * leaving the designer in control of what it remembers.
 */
export function FeedbackMemoryPanel() {
  const { project, update } = useProject();
  const [adding, setAdding] = useState<"positive" | "negative" | null>(null);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(true);

  if (!project) return null;

  const constraints = project.feedbackMemory.constraints;
  const positive = constraints.filter((c) => c.polarity === "positive");
  const negative = constraints.filter((c) => c.polarity === "negative");
  const activeCount = constraints.filter((c) => c.active).length;

  const submit = async () => {
    if (!draft.trim() || !adding) return;
    await update(
      (p) =>
        addConstraints(p, [
          makeConstraint(adding, draft, "designer", "Added manually"),
        ]),
      null,
    );
    setDraft("");
    setAdding(null);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 pb-2 text-left"
      >
        <span className="label-xs flex items-center gap-1.5">
          <Brain size={11} />
          Design memory
        </span>
        <span className="text-[10px] text-faint">{activeCount} active</span>
      </button>

      {expanded ? (
        <div className="space-y-3 px-3">
          <p className="text-[11px] leading-relaxed text-faint">
            Applied to every generation from here on.
          </p>

          <ConstraintGroup
            label="Keep"
            tone="positive"
            constraints={positive}
            onToggle={(id) => update((p) => toggleConstraint(p, id), null)}
            onRemove={(id) => update((p) => removeConstraint(p, id), null)}
            onAdd={() => setAdding("positive")}
          />

          <ConstraintGroup
            label="Avoid"
            tone="negative"
            constraints={negative}
            onToggle={(id) => update((p) => toggleConstraint(p, id), null)}
            onRemove={(id) => update((p) => removeConstraint(p, id), null)}
            onAdd={() => setAdding("negative")}
          />

          {adding ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  adding === "positive" ? "Sharp geometric corners" : "No gradients"
                }
                className="text-[12px]"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setAdding(null);
                    setDraft("");
                  }
                }}
              />
              <div className="flex gap-1.5">
                <Button type="submit" size="sm" variant="secondary" className="flex-1">
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAdding(null);
                    setDraft("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ConstraintGroup({
  label,
  tone,
  constraints,
  onToggle,
  onRemove,
  onAdd,
}: {
  label: string;
  tone: "positive" | "negative";
  constraints: Array<{ id: string; text: string; active: boolean; origin: string }>;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className={cn(
            "flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.1em]",
            tone === "positive" ? "text-success/80" : "text-danger/80",
          )}
        >
          {tone === "positive" ? <Plus size={9} /> : <Minus size={9} />}
          {label}
        </span>
        <IconButton label={`Add ${label.toLowerCase()} constraint`} onClick={onAdd} className="h-5 w-5">
          <Plus size={11} />
        </IconButton>
      </div>

      {constraints.length === 0 ? (
        <p className="text-[11px] text-faint/70">None yet</p>
      ) : (
        <ul className="space-y-1">
          {constraints.map((c) => (
            <li key={c.id} className="group flex items-start gap-1.5">
              <button
                type="button"
                onClick={() => onToggle(c.id)}
                title={c.active ? `Active · from ${c.origin}` : `Muted · from ${c.origin}`}
                className={cn(
                  "min-w-0 flex-1 rounded px-1.5 py-1 text-left text-[11px] leading-snug transition-colors",
                  c.active
                    ? tone === "positive"
                      ? "text-success/90 hover:bg-success/8"
                      : "text-danger/85 hover:bg-danger/8"
                    : "text-faint/60 line-through hover:bg-white/4",
                )}
              >
                {c.text}
              </button>
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                aria-label="Remove constraint"
                className="mt-1 shrink-0 text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
              >
                <X size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
