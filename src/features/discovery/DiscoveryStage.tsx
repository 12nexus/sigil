"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Pencil,
  Plus,
  SkipForward,
} from "lucide-react";
import { AiNote } from "@/components/AiNote";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import {
  Badge,
  ErrorNotice,
  Panel,
  ProgressBar,
} from "@/components/ui/Primitives";
import { StageHeader } from "@/features/workspace/StageHeader";
import { useLoadedProject } from "@/hooks/useProject";
import { resolveGenerationSettings, useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/useToast";
import { generateBrandQuestions } from "@/services/gemini";
import { GeminiError } from "@/services/gemini/errors";
import type { DiscoveryQuestion, GeminiErrorCode } from "@/types";
import { timelineEvent } from "@/workflows/projectFactory";
import { newId } from "@/utils/id";
import { cn } from "@/utils/cn";

export function DiscoveryStage() {
  const router = useRouter();
  const { project, update } = useLoadedProject();
  const { settings, keyConfigured } = useSettings();
  const { push } = useToast();

  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<{ message: string; code: GeminiErrorCode } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(project.discovery.additionalNotes);

  const generationSettings = resolveGenerationSettings(settings, project);
  const { questions, status, estimatedTotal, sufficiencyReason } = project.discovery;

  const answered = useMemo(
    () => questions.filter((q) => (q.answer && q.answer.trim()) || q.skipped),
    [questions],
  );
  const pending = useMemo(
    () => questions.filter((q) => !q.answer?.trim() && !q.skipped),
    [questions],
  );

  const total = Math.max(estimatedTotal, questions.length);
  const progress = total === 0 ? 0 : answered.length / total;
  const allCurrentAnswered = pending.length === 0;

  /* ------------------------------ actions ------------------------------ */

  const setAnswer = async (questionId: string, answer: string, skipped = false) => {
    await update((p) => ({
      ...p,
      discovery: {
        ...p.discovery,
        status: p.discovery.status === "not_started" ? "in_progress" : p.discovery.status,
        questions: p.discovery.questions.map((q) =>
          q.id === questionId
            ? {
                ...q,
                answer: skipped ? q.answer : answer,
                skipped,
                answeredAt: new Date().toISOString(),
              }
            : q,
        ),
      },
    }));
    setEditing(null);
  };

  const askNext = async () => {
    if (!keyConfigured) {
      setError({
        message: "No Gemini API key is configured.",
        code: "MISSING_KEY",
      });
      return;
    }
    setThinking(true);
    setError(null);
    try {
      const analysis = await generateBrandQuestions(project, generationSettings);

      if (analysis.sufficient) {
        await update(
          (p) => ({
            ...p,
            discovery: {
              ...p.discovery,
              status: "sufficient",
              sufficiencyReason: analysis.reason,
              estimatedTotal: p.discovery.questions.length,
              lastAnalyzedAt: new Date().toISOString(),
            },
          }),
          timelineEvent(
            "ai",
            "Discovery judged sufficient",
            analysis.reason,
            "discovery",
          ),
        );
        push({ tone: "success", title: "Enough to write the brief" });
        return;
      }

      const existingKeys = new Set(project.discovery.questions.map((q) => q.key));
      const fresh = analysis.nextQuestions
        .filter((q) => !existingKeys.has(q.key))
        .map<DiscoveryQuestion>((q, i) => ({
          ...q,
          id: newId("q"),
          order: project.discovery.questions.length + i,
        }));

      if (!fresh.length) {
        // The model had nothing new to ask — treat that as sufficiency rather
        // than looping the designer on duplicate questions.
        await update((p) => ({
          ...p,
          discovery: {
            ...p.discovery,
            status: "sufficient",
            sufficiencyReason:
              "No further questions would change the design. Ready to write the brief.",
            lastAnalyzedAt: new Date().toISOString(),
          },
        }));
        return;
      }

      await update(
        (p) => ({
          ...p,
          discovery: {
            ...p.discovery,
            status: "in_progress",
            questions: [...p.discovery.questions, ...fresh],
            estimatedTotal: Math.max(
              p.discovery.questions.length + fresh.length,
              p.discovery.questions.length + analysis.estimatedRemaining,
            ),
            lastAnalyzedAt: new Date().toISOString(),
          },
        }),
        timelineEvent(
          "ai",
          `${fresh.length} follow-up question${fresh.length === 1 ? "" : "s"} added`,
          analysis.gaps.length ? `Gaps identified: ${analysis.gaps.join("; ")}` : undefined,
          "discovery",
        ),
      );
    } catch (err) {
      const geminiError = GeminiError.from(err);
      setError({ message: geminiError.message, code: geminiError.code });
    } finally {
      setThinking(false);
    }
  };

  const completeDiscovery = async () => {
    await update(
      (p) => ({
        ...p,
        stage: "brief",
        discovery: { ...p.discovery, status: "complete" },
      }),
      timelineEvent(
        "decision",
        "Discovery complete",
        `${answered.length} questions answered.`,
        "discovery",
      ),
    );
    router.push(`/projects/${project.id}/brief`);
  };

  const saveNotes = async () => {
    await update((p) => ({
      ...p,
      discovery: { ...p.discovery, additionalNotes: notesDraft },
    }));
    setNotesOpen(false);
    push({ tone: "success", title: "Context saved" });
  };

  /* -------------------------------- view ------------------------------- */

  return (
    <>
      <StageHeader
        stage="discovery"
        // Every other stage puts its primary action in the stage header.
        // Discovery was the exception, which left the only way forward buried
        // below however many questions the interview happened to produce.
        action={
          status !== "complete" && answered.length >= 4 ? (
            <Button variant="accent" size="sm" onClick={completeDiscovery}>
              Write the brief
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {/* Progress */}
        <Panel className="!p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-ink">
              Discovery: {answered.length} of approximately {total} questions
            </p>
            <div className="flex items-center gap-2">
              {status === "sufficient" ? (
                <Badge tone="success">Ready for the brief</Badge>
              ) : status === "complete" ? (
                <Badge tone="success">Complete</Badge>
              ) : (
                <Badge tone="neutral">{pending.length} open</Badge>
              )}
            </div>
          </div>
          <ProgressBar value={progress} className="mt-3" />
        </Panel>

        {status === "sufficient" || status === "complete" ? (
          <AiNote
            tone="accent"
            did={
              status === "complete"
                ? "Discovery is closed and the brief has been written from these answers."
                : "Gemini reviewed your answers and has enough to write a defensible brand brief."
            }
            why={sufficiencyReason}
            next={
              status === "complete"
                ? "You can still edit any answer here — the brief can be regenerated from the updated interview."
                : "Move to the brand brief, or keep adding context first."
            }
            action={
              status === "sufficient" ? (
                <Button variant="accent" size="sm" onClick={completeDiscovery}>
                  Write the brief
                </Button>
              ) : undefined
            }
          />
        ) : null}

        {error ? (
          <ErrorNotice
            title="Could not reach Gemini"
            message={error.message}
            code={error.code}
            onRetry={askNext}
            onDismiss={() => setError(null)}
          />
        ) : null}

        {/* Open questions */}
        {pending.length > 0 ? (
          <div className="space-y-4">
            {pending.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                onAnswer={(value) => setAnswer(question.id, value)}
                onSkip={() => setAnswer(question.id, "", true)}
              />
            ))}
          </div>
        ) : null}

        {/* Continue / complete */}
        {status !== "complete" ? (
          <div className="flex flex-wrap items-center gap-3">
            {allCurrentAnswered && status !== "sufficient" ? (
              <Button
                variant="accent"
                onClick={askNext}
                loading={thinking}
                icon={<ArrowRight size={14} />}
              >
                {thinking ? "Reviewing your answers" : "Continue the interview"}
              </Button>
            ) : null}

            {answered.length >= 4 && status !== "sufficient" ? (
              <Button variant="ghost" size="sm" onClick={completeDiscovery}>
                Skip ahead and write the brief now
              </Button>
            ) : null}

            {status === "sufficient" ? (
              <Button variant="accent" onClick={completeDiscovery}>
                Write the brief
              </Button>
            ) : null}
          </div>
        ) : (
          <Button variant="secondary" onClick={() => router.push(`/projects/${project.id}/brief`)}>
            Go to the brand brief
          </Button>
        )}

        {/* Answered */}
        {answered.length > 0 ? (
          <section className="pt-2">
            <h2 className="label-xs mb-3">Answers so far</h2>
            <div className="space-y-2.5">
              {answered.map((question) => (
                <AnsweredCard
                  key={question.id}
                  question={question}
                  editing={editing === question.id}
                  onEdit={() => setEditing(question.id)}
                  onCancel={() => setEditing(null)}
                  onSave={(value) => setAnswer(question.id, value)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* Extra context */}
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-[13px] text-ink">Anything else worth knowing?</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Context that does not fit a question — history, politics, a founder&apos;s strong
                opinion. It goes into the brief and every generation after it.
              </p>
              {project.discovery.additionalNotes && !notesOpen ? (
                <p className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 text-[12px] leading-relaxed text-muted">
                  {project.discovery.additionalNotes}
                </p>
              ) : null}
            </div>
            {!notesOpen ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus size={13} />}
                onClick={() => {
                  setNotesDraft(project.discovery.additionalNotes);
                  setNotesOpen(true);
                }}
              >
                {project.discovery.additionalNotes ? "Edit" : "Add"}
              </Button>
            ) : null}
          </div>

          {notesOpen ? (
            <div className="mt-4 space-y-3">
              <Textarea
                rows={4}
                autoFocus
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="The founders have rejected two previous logo attempts, both blue, both using a network motif…"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={saveNotes}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNotesOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function QuestionCard({
  question,
  onAnswer,
  onSkip,
}: {
  question: DiscoveryQuestion;
  onAnswer: (value: string) => void;
  onSkip: () => void;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim()) return;
    onAnswer(value);
    setValue("");
  };

  return (
    <Panel className="animate-rise border-accent/20">
      <div className="flex items-start gap-3">
        <CircleHelp size={15} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] leading-snug text-ink">{question.question}</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-faint">{question.why}</p>

          <div className="mt-4">
            {question.kind === "choice" && question.options?.length ? (
              <div className="flex flex-wrap gap-2">
                {question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onAnswer(option)}
                    className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-ink"
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : question.kind === "short" || question.kind === "list" ? (
              <Input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={question.placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            ) : (
              <Textarea
                autoFocus
                rows={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={question.placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            )}
          </div>

          {question.kind !== "choice" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="accent" onClick={submit} disabled={!value.trim()}>
                Answer
              </Button>
              {!question.required ? (
                <Button size="sm" variant="ghost" icon={<SkipForward size={12} />} onClick={onSkip}>
                  Skip
                </Button>
              ) : null}
              <span className="ml-auto text-[10px] text-faint">
                {question.kind === "long" ? "⌘↵ to submit" : "↵ to submit"}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function AnsweredCard({
  question,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  question: DiscoveryQuestion;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(question.answer ?? "");

  if (editing) {
    return (
      <div className="rounded-xl border border-accent/30 bg-surface p-4">
        <p className="text-[12px] text-muted">{question.question}</p>
        <Textarea
          autoFocus
          rows={3}
          className="mt-2"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onSave(draft)}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong",
        question.skipped && "opacity-60",
      )}
    >
      <Check
        size={13}
        className={cn("mt-1 shrink-0", question.skipped ? "text-faint" : "text-success")}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] leading-snug text-muted">{question.question}</p>
        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
          {question.skipped ? (
            <span className="italic text-faint">Skipped</span>
          ) : (
            question.answer
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          setDraft(question.answer ?? "");
          onEdit();
        }}
        aria-label="Edit answer"
        className="shrink-0 rounded p-1 text-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}
