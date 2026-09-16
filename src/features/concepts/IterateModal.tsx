"use client";

import { useState } from "react";
import { ArrowRight, GitBranch, Minus, Plus, Sparkles } from "lucide-react";
import { ConceptImage } from "@/components/ConceptImage";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Badge, ErrorNotice, Modal } from "@/components/ui/Primitives";
import { useLoadedProject } from "@/hooks/useProject";
import { resolveGenerationSettings, useSettings } from "@/hooks/useSettings";
import { generateLogoIterations } from "@/services/gemini";
import { GeminiError } from "@/services/gemini/errors";
import type { GeminiErrorCode, GenerationJob, IterationInstruction } from "@/types";
import { addConstraints, makeConstraint } from "@/workflows/mutations";
import { createIterationJob } from "@/workflows/generation";
import { timelineEvent } from "@/workflows/projectFactory";

/** Feedback phrasings that map cleanly onto structured instructions. */
const QUICK_FEEDBACK = [
  "Make the symbol simpler",
  "Keep the symbol but make it more premium",
  "I like the shape but not the typography",
  "Make the negative space more obvious",
  "Make it work better at favicon size",
  "Keep the concept but explore more geometric versions",
  "Reduce it to a single weight of line",
  "Try a version with no letterform at all",
];

/**
 * The iteration engine (spec §16).
 *
 * Natural-language feedback is converted into structured design instructions
 * that the designer confirms — and can edit — before a single image is
 * generated. That confirmation step is what keeps the AI executing the
 * designer's intent rather than its own interpretation of it.
 */
export function IterateModal({
  conceptId,
  onClose,
  onStart,
}: {
  conceptId: string;
  onClose: () => void;
  onStart: (job: GenerationJob) => void;
}) {
  const { project, update } = useLoadedProject();
  const { settings, keyConfigured } = useSettings();
  const generationSettings = resolveGenerationSettings(settings, project);

  const [feedback, setFeedback] = useState("");
  const [count, setCount] = useState(generationSettings.defaultIterationCount);
  const [instruction, setInstruction] = useState<IterationInstruction | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<{ message: string; code: GeminiErrorCode } | null>(null);

  const concept = project.concepts.find((c) => c.id === conceptId);
  if (!concept) return null;

  const interpret = async () => {
    if (!keyConfigured) {
      setError({ message: "No Gemini API key is configured.", code: "MISSING_KEY" });
      return;
    }
    if (!feedback.trim()) return;
    setThinking(true);
    setError(null);
    try {
      const result = await generateLogoIterations(
        project,
        concept,
        feedback,
        count,
        generationSettings,
      );
      setInstruction(result);
    } catch (err) {
      const geminiError = GeminiError.from(err);
      setError({ message: geminiError.message, code: geminiError.code });
    } finally {
      setThinking(false);
    }
  };

  const generate = async () => {
    if (!instruction) return;

    // Durable preferences enter design memory before the batch runs, so this
    // round's lesson applies to every generation after it.
    const constraints = instruction.newConstraints.map((c) =>
      makeConstraint(c.polarity, c.text, "designer", `Refining ${concept.code}`),
    );

    const next = await update(
      (p) => addConstraints(p, constraints),
      timelineEvent(
        "generation",
        `${instruction.explore.length} variations requested from ${concept.code}`,
        instruction.intent,
        "refinement",
      ),
    );

    const job = createIterationJob(next ?? project, concept, instruction);
    onStart(job);
    onClose();
  };

  const editList = (
    key: "preserve" | "change" | "remove" | "explore",
    index: number,
    value: string,
  ) => {
    if (!instruction) return;
    const next = [...instruction[key]];
    if (value.trim()) next[index] = value;
    else next.splice(index, 1);
    setInstruction({ ...instruction, [key]: next });
  };

  const addItem = (key: "preserve" | "change" | "remove" | "explore") => {
    if (!instruction) return;
    setInstruction({ ...instruction, [key]: [...instruction[key], ""] });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Refine ${concept.code} — ${concept.name}`}
      description="Say what you want in your own words. SIGIL turns it into design instructions for you to confirm."
      footer={
        instruction ? (
          <>
            <Button variant="ghost" onClick={() => setInstruction(null)}>
              Back to feedback
            </Button>
            <Button variant="accent" icon={<GitBranch size={14} />} onClick={generate}>
              Generate {instruction.explore.length} variations
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={interpret}
              loading={thinking}
              disabled={!feedback.trim()}
              icon={<Sparkles size={14} />}
            >
              Interpret feedback
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        {error ? (
          <ErrorNotice
            message={error.message}
            code={error.code}
            onRetry={interpret}
            onDismiss={() => setError(null)}
          />
        ) : null}

        <div className="flex gap-4">
          <ConceptImage
            assetId={concept.primaryAssetId}
            alt={concept.name}
            className="h-28 w-28 shrink-0"
            imgClassName="p-2"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink">{concept.name}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{concept.objective}</p>
            {concept.iterationNumber > 0 ? (
              <Badge tone="violet" className="mt-2">
                Generation {concept.iterationNumber}
              </Badge>
            ) : null}
          </div>
        </div>

        {!instruction ? (
          <>
            <Field label="What should change?" required>
              <Textarea
                autoFocus
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="I like the shape but not the typography. Keep the mark exactly as it is and try it with something heavier and more technical."
              />
            </Field>

            <div>
              <p className="label-xs mb-2">Or start from a common note</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_FEEDBACK.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() =>
                      setFeedback((prev) => (prev ? `${prev} ${phrase}.` : `${phrase}.`))
                    }
                    className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-ink"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>

            <Field label="How many variations?" hint="3–6 works well">
              <Input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 4)))}
              />
            </Field>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-violet/25 bg-violet/[0.04] p-4">
              <p className="text-[13px] text-ink">{instruction.intent}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                Edit anything below before generating — this is what the image model will be
                told, and it is a contract, not a suggestion.
              </p>
            </div>

            <InstructionList
              label="Preserve"
              tone="success"
              items={instruction.preserve}
              onEdit={(i, v) => editList("preserve", i, v)}
              onAdd={() => addItem("preserve")}
            />
            <InstructionList
              label="Change"
              tone="accent"
              items={instruction.change}
              onEdit={(i, v) => editList("change", i, v)}
              onAdd={() => addItem("change")}
            />
            <InstructionList
              label="Remove entirely"
              tone="danger"
              items={instruction.remove}
              onEdit={(i, v) => editList("remove", i, v)}
              onAdd={() => addItem("remove")}
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="label-xs">
                  Variations to explore ({instruction.explore.length})
                </p>
                <button
                  type="button"
                  onClick={() => addItem("explore")}
                  className="inline-flex items-center gap-1 text-[11px] text-faint hover:text-accent"
                >
                  <Plus size={11} />
                  Add one
                </button>
              </div>
              <ol className="space-y-2">
                {instruction.explore.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-2 font-mono text-[11px] text-faint">
                      {concept.code}.{i + 1}
                    </span>
                    <Textarea
                      rows={2}
                      value={item}
                      onChange={(e) => editList("explore", i, e.target.value)}
                    />
                  </li>
                ))}
              </ol>
            </div>

            {instruction.newConstraints.length > 0 ? (
              <div>
                <p className="label-xs mb-2">Will be remembered for all future generations</p>
                <ul className="flex flex-wrap gap-1.5">
                  {instruction.newConstraints.map((c, i) => (
                    <li key={i}>
                      <Badge tone={c.polarity === "positive" ? "success" : "danger"}>
                        {c.polarity === "positive" ? <Plus size={9} /> : <Minus size={9} />}
                        {c.text}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setInstruction({ ...instruction, newConstraints: [] })}
                  className="mt-2 text-[11px] text-faint underline underline-offset-2 hover:text-muted"
                >
                  Don&apos;t remember these
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}

function InstructionList({
  label,
  tone,
  items,
  onEdit,
  onAdd,
}: {
  label: string;
  tone: "success" | "accent" | "danger";
  items: string[];
  onEdit: (index: number, value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="label-xs">{label}</p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 text-[11px] text-faint hover:text-accent"
        >
          <Plus size={11} />
          Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-[12px] italic text-faint">Nothing</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <ArrowRight
                size={11}
                className={
                  tone === "success"
                    ? "shrink-0 text-success"
                    : tone === "danger"
                      ? "shrink-0 text-danger"
                      : "shrink-0 text-accent"
                }
              />
              <Input
                value={item}
                onChange={(e) => onEdit(i, e.target.value)}
                className="!py-1.5 !text-[12px]"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
