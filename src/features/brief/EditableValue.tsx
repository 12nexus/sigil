"use client";

import { useRef, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { cn } from "@/utils/cn";

/**
 * Click-to-edit primitives.
 *
 * Every field in the brief is editable in place rather than behind a modal —
 * the brief is a working document, and the designer is expected to rewrite
 * parts of it before approving.
 */

export function EditableText({
  value,
  onSave,
  multiline = false,
  placeholder = "Not set",
  className,
  rows = 3,
}: {
  value: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const commit = () => {
    if (draft !== value) onSave(draft);
    setEditing(false);
  };

  if (editing) {
    const Control = multiline ? Textarea : Input;
    return (
      <div className="space-y-2">
        <Control
          ref={ref as any}
          autoFocus
          rows={multiline ? rows : undefined}
          value={draft}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setDraft(e.target.value)
          }
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Escape") setEditing(false);
            if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
        />
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={commit}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={cn(
        "group -mx-2 flex w-[calc(100%+1rem)] items-start gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-white/4",
        className,
      )}
    >
      <span
        className={cn(
          "min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed",
          value ? "text-ink" : "italic text-faint",
        )}
      >
        {value || placeholder}
      </span>
      <Pencil
        size={11}
        className="mt-1 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}

export function EditableList({
  items,
  onSave,
  placeholder = "Add an item",
  tone = "neutral",
}: {
  items: string[];
  onSave: (items: string[]) => void;
  placeholder?: string;
  tone?: "neutral" | "danger" | "accent";
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const tones = {
    neutral: "border-line bg-surface-2 text-ink",
    danger: "border-danger/25 bg-danger/8 text-danger/90",
    accent: "border-accent/25 bg-accent/8 text-accent",
  };

  const add = () => {
    if (!draft.trim()) return;
    onSave([...items, draft.trim()]);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && !adding ? (
        <p className="text-[12px] italic text-faint">Nothing listed</p>
      ) : null}

      <ul className="flex flex-wrap gap-1.5">
        {items.map((item, i) =>
          editingIndex === i ? (
            <li key={i} className="w-full">
              <Input
                autoFocus
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={() => {
                  const next = [...items];
                  if (editDraft.trim()) next[i] = editDraft.trim();
                  else next.splice(i, 1);
                  onSave(next);
                  setEditingIndex(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditingIndex(null);
                }}
              />
            </li>
          ) : (
            <li key={i}>
              <span
                className={cn(
                  "group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] leading-snug",
                  tones[tone],
                )}
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() => {
                    setEditDraft(item);
                    setEditingIndex(i);
                  }}
                >
                  {item}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => onSave(items.filter((_, index) => index !== i))}
                  className="shrink-0 opacity-0 transition-opacity hover:text-danger group-hover:opacity-60"
                >
                  <X size={10} />
                </button>
              </span>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-accent"
        >
          <Plus size={11} />
          Add
        </button>
      )}
    </div>
  );
}
