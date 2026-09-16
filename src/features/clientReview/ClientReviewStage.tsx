"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  MessageSquare,
  Sparkles,
  Upload,
} from "lucide-react";
import { AiNote } from "@/components/AiNote";
import { ConceptImage } from "@/components/ConceptImage";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Badge, EmptyState, Panel } from "@/components/ui/Primitives";
import { StageHeader } from "@/features/workspace/StageHeader";
import { useLoadedProject } from "@/hooks/useProject";
import { resolveGenerationSettings, useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/useToast";
import { analyzeClientFeedback } from "@/services/gemini";
import { GeminiError } from "@/services/gemini/errors";
import type { ClientFeedbackEntry, FeedbackInterpretation, LogoConcept } from "@/types";
import { addConstraints, makeConstraint, toggleClientVisible } from "@/workflows/mutations";
import { timelineEvent } from "@/workflows/projectFactory";
import { formatRelative } from "@/utils/format";
import { EditableList } from "@/features/brief/EditableValue";

export function ClientReviewStage() {
  const router = useRouter();
  const { project, update } = useLoadedProject();
  const { settings } = useSettings();
  const { push } = useToast();
  const generationSettings = resolveGenerationSettings(settings, project);

  const [title, setTitle] = useState(project.clientReview.presentationTitle);
  const [intro, setIntro] = useState(project.clientReview.presentationIntro);
  const [interpreting, setInterpreting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const finalists = useMemo(
    () =>
      project.finalistIds
        .map((id) => project.concepts.find((c) => c.id === id))
        .filter(Boolean) as LogoConcept[],
    [project.finalistIds, project.concepts],
  );

  const visibleCount = finalists.filter((c) => c.clientVisible).length;
  const feedback = project.clientReview.feedback;
  const pending = feedback.filter((f) => f.interpretationStatus === "pending_review");

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/present/${project.id}`
      : `/present/${project.id}`;

  /* ----------------------------- publishing ---------------------------- */

  const publish = async (published: boolean) => {
    await update(
      (p) => ({
        ...p,
        clientReview: {
          ...p.clientReview,
          published,
          publishedAt: published ? new Date().toISOString() : p.clientReview.publishedAt,
          presentationTitle: title,
          presentationIntro: intro,
          round: published ? p.clientReview.round + 1 : p.clientReview.round,
        },
      }),
      timelineEvent(
        "client",
        published ? "Client presentation published" : "Client presentation unpublished",
        published ? `${visibleCount} concepts shared, round ${project.clientReview.round + 1}.` : undefined,
        "client-review",
      ),
    );
    push({
      tone: "success",
      title: published ? "Presentation published" : "Presentation withdrawn",
    });
  };

  const savePresentation = () =>
    update(
      (p) => ({
        ...p,
        clientReview: {
          ...p.clientReview,
          presentationTitle: title,
          presentationIntro: intro,
        },
      }),
      null,
    );

  /* ---------------------------- interpretation ------------------------- */

  const interpret = async (entry: ClientFeedbackEntry) => {
    setInterpreting(entry.id);
    try {
      const concept = entry.conceptId
        ? project.concepts.find((c) => c.id === entry.conceptId)
        : undefined;
      const interpretation = await analyzeClientFeedback(
        project,
        entry,
        concept,
        generationSettings,
      );
      await update(
        (p) => ({
          ...p,
          clientReview: {
            ...p.clientReview,
            feedback: p.clientReview.feedback.map((f) =>
              f.id === entry.id
                ? { ...f, interpretation, interpretationStatus: "pending_review" as const }
                : f,
            ),
          },
        }),
        timelineEvent(
          "ai",
          "Client feedback interpreted",
          interpretation.summary,
          "client-review",
        ),
      );
    } catch (err) {
      push({
        tone: "error",
        title: "Could not interpret the feedback",
        body: GeminiError.from(err).message,
      });
    } finally {
      setInterpreting(null);
    }
  };

  const editInterpretation = (entryId: string, patch: Partial<FeedbackInterpretation>) =>
    update(
      (p) => ({
        ...p,
        clientReview: {
          ...p.clientReview,
          feedback: p.clientReview.feedback.map((f) =>
            f.id === entryId && f.interpretation
              ? {
                  ...f,
                  interpretation: { ...f.interpretation, ...patch },
                  interpretationStatus: "edited" as const,
                }
              : f,
          ),
        },
      }),
      null,
    );

  const approveInterpretation = async (entry: ClientFeedbackEntry) => {
    if (!entry.interpretation) return;

    const constraints = [
      ...entry.interpretation.positive.map((text) =>
        makeConstraint("positive", text, "client", "Client feedback"),
      ),
      ...entry.interpretation.negative.map((text) =>
        makeConstraint("negative", text, "client", "Client feedback"),
      ),
    ];

    await update(
      (p) =>
        addConstraints(
          {
            ...p,
            clientReview: {
              ...p.clientReview,
              feedback: p.clientReview.feedback.map((f) =>
                f.id === entry.id
                  ? {
                      ...f,
                      interpretationStatus: "approved" as const,
                      processedAt: new Date().toISOString(),
                    }
                  : f,
              ),
            },
          },
          constraints,
        ),
      timelineEvent(
        "decision",
        "Client feedback interpretation approved",
        `${constraints.length} constraint${constraints.length === 1 ? "" : "s"} added to design memory.`,
        "client-review",
      ),
    );
    push({
      tone: "success",
      title: "Interpretation approved",
      body: "Refine the concept to act on it.",
    });
  };

  const recordClientApproval = async (conceptId: string) => {
    const concept = project.concepts.find((c) => c.id === conceptId);
    await update(
      (p) => ({
        ...p,
        approvals: {
          ...p.approvals,
          client: {
            approved: true,
            conceptId,
            at: new Date().toISOString(),
            by: p.client.contactName || "Client",
          },
        },
        stage: "finalization",
      }),
      timelineEvent(
        "client",
        `Client approved ${concept?.code}`,
        concept?.name,
        "client-review",
      ),
    );
    push({ tone: "success", title: "Client approval recorded" });
    router.push(`/projects/${project.id}/finalization`);
  };

  if (finalists.length === 0) {
    return (
      <>
        <StageHeader stage="client-review" />
        <EmptyState
          title="No finalists to present"
          description="Promote and build out finalists before presenting to the client."
          action={
            <Button
              variant="accent"
              onClick={() => router.push(`/projects/${project.id}/finalists`)}
            >
              Back to finalists
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <StageHeader
        stage="client-review"
        action={
          <div className="flex flex-wrap gap-2">
            <a href={shareUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}>
                Preview
              </Button>
            </a>
            <Button
              variant={project.clientReview.published ? "secondary" : "accent"}
              size="sm"
              icon={<Upload size={13} />}
              onClick={() => publish(!project.clientReview.published)}
            >
              {project.clientReview.published ? "Unpublish" : "Publish presentation"}
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        <AiNote
          did={
            project.clientReview.published
              ? `The presentation is live with ${visibleCount} concept${visibleCount === 1 ? "" : "s"}, round ${project.clientReview.round}.`
              : "Client presentation mode shows only the work — no prompts, no rejected concepts, no ratings, no internal notes."
          }
          why="Clients speak in feelings. When feedback arrives, Gemini translates it into design requirements — and you confirm that reading before anything is generated from it."
          next={
            pending.length > 0
              ? `${pending.length} interpretation${pending.length === 1 ? "" : "s"} waiting for your confirmation below.`
              : project.clientReview.published
                ? "Share the link, then process feedback as it arrives."
                : "Set up the presentation and publish it."
          }
        />

        {/* ------------------------- share link -------------------------- */}
        {project.clientReview.published ? (
          <Panel className="border-accent/25">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="label-xs mb-2">Client link</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[11px] text-muted">
                    {shareUrl}
                  </code>
                  <IconButton
                    label="Copy link"
                    onClick={() => {
                      void navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  </IconButton>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-faint">
                  SIGIL stores everything in this browser, so this link opens the live
                  presentation on this machine. To send it to a client on another device,
                  connect a backend — the data layer is built to be swapped without
                  touching the UI.
                </p>
              </div>
            </div>
          </Panel>
        ) : null}

        {/* ------------------------ presentation ------------------------- */}
        <Panel>
          <h2 className="mb-4 text-[14px] text-ink">Presentation setup</h2>
          <div className="space-y-4">
            <Field label="Title">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={savePresentation}
              />
            </Field>
            <Field
              label="Opening note"
              hint="Optional — sets up the work before they see it"
            >
              <Textarea
                rows={3}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                onBlur={savePresentation}
                placeholder="Three directions, each solving the same brief differently. Take your time — we can refine any of them."
              />
            </Field>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <p className="label-xs mb-3">What the client will see · {visibleCount} of {finalists.length}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {finalists.map((concept) => (
                <button
                  key={concept.id}
                  type="button"
                  onClick={() => update((p) => toggleClientVisible(p, concept.id), null)}
                  className={
                    concept.clientVisible
                      ? "rounded-lg border border-accent/40 p-2 transition-colors"
                      : "rounded-lg border border-line p-2 opacity-40 transition-colors hover:opacity-70"
                  }
                >
                  <ConceptImage
                    assetId={concept.primaryAssetId}
                    alt={concept.name}
                    imgClassName="p-2"
                  />
                  <span className="mt-2 flex items-center justify-between gap-1 px-0.5">
                    <span className="truncate text-[11px] text-muted">{concept.name}</span>
                    {concept.clientVisible ? (
                      <Eye size={11} className="shrink-0 text-accent" />
                    ) : (
                      <EyeOff size={11} className="shrink-0 text-faint" />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Concept codes, ratings, AI critiques, prompts, rejected work, and your private
              notes are never included in the presentation.
            </p>
          </div>
        </Panel>

        {/* -------------------------- feedback --------------------------- */}
        <section>
          <h2 className="mb-3 text-[14px] text-ink">
            Client feedback
            {feedback.length > 0 ? (
              <span className="ml-2 text-[12px] text-faint">{feedback.length} received</span>
            ) : null}
          </h2>

          {feedback.length === 0 ? (
            <Panel className="text-center">
              <MessageSquare size={22} className="mx-auto mb-3 text-faint" />
              <p className="text-[13px] text-muted">No feedback yet</p>
              <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-faint">
                Anything the client submits through the presentation appears here for you to
                interpret and act on.
              </p>
            </Panel>
          ) : (
            <div className="space-y-4">
              {[...feedback].reverse().map((entry) => (
                <FeedbackCard
                  key={entry.id}
                  entry={entry}
                  concept={
                    entry.conceptId
                      ? project.concepts.find((c) => c.id === entry.conceptId)
                      : undefined
                  }
                  interpreting={interpreting === entry.id}
                  onInterpret={() => interpret(entry)}
                  onEdit={(patch) => editInterpretation(entry.id, patch)}
                  onApprove={() => approveInterpretation(entry)}
                  onRefine={() => router.push(`/projects/${project.id}/refinement`)}
                  onRecordApproval={
                    entry.decision === "approved" && entry.conceptId
                      ? () => recordClientApproval(entry.conceptId!)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* ---------------------- manual approval ------------------------ */}
        {!project.approvals.client.approved ? (
          <Panel className="border-accent/20">
            <h3 className="text-[14px] text-ink">Record client approval</h3>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted">
              If the client approved a concept over a call or by email rather than through the
              presentation, record it here. This is the client&apos;s approval — final approval
              is a separate, explicit step at finalization.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {finalists.map((concept) => (
                <button
                  key={concept.id}
                  type="button"
                  aria-label={`Record client approval of ${concept.name}`}
                  onClick={() => recordClientApproval(concept.id)}
                  className="rounded-lg border border-line p-2 text-left transition-colors hover:border-accent/50"
                >
                  <ConceptImage
                    assetId={concept.primaryAssetId}
                    alt={concept.name}
                    imgClassName="p-2"
                  />
                  <span className="mt-2 block truncate px-0.5 text-[11px] text-muted">
                    Approve {concept.name}
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel className="flex flex-wrap items-center justify-between gap-4 border-success/25">
            <div>
              <h3 className="flex items-center gap-2 text-[14px] text-ink">
                <Check size={15} className="text-success" />
                Client approved
              </h3>
              <p className="mt-1 text-[12px] text-muted">
                {project.concepts.find((c) => c.id === project.approvals.client.conceptId)?.name}{" "}
                · {formatRelative(project.approvals.client.at!)}
              </p>
            </div>
            <Button
              variant="accent"
              icon={<ArrowRight size={14} />}
              onClick={() => router.push(`/projects/${project.id}/finalization`)}
            >
              Go to finalization
            </Button>
          </Panel>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function FeedbackCard({
  entry,
  concept,
  interpreting,
  onInterpret,
  onEdit,
  onApprove,
  onRefine,
  onRecordApproval,
}: {
  entry: ClientFeedbackEntry;
  concept?: LogoConcept;
  interpreting: boolean;
  onInterpret: () => void;
  onEdit: (patch: Partial<FeedbackInterpretation>) => void;
  onApprove: () => void;
  onRefine: () => void;
  onRecordApproval?: () => void;
}) {
  const { interpretation, interpretationStatus } = entry;

  return (
    <Panel
      className={
        entry.decision === "approved"
          ? "border-success/25"
          : entry.decision === "changes_requested"
            ? "border-caution/25"
            : undefined
      }
    >
      <div className="flex flex-wrap items-start gap-4">
        {concept ? (
          <ConceptImage
            assetId={concept.primaryAssetId}
            alt={concept.name}
            className="h-20 w-20 shrink-0"
            imgClassName="p-1.5"
          />
        ) : null}
        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {entry.decision === "approved" ? (
              <Badge tone="success">Approved</Badge>
            ) : entry.decision === "changes_requested" ? (
              <Badge tone="caution">Changes requested</Badge>
            ) : (
              <Badge tone="neutral">Comment</Badge>
            )}
            {concept ? (
              <span className="text-[12px] text-muted">on {concept.name}</span>
            ) : (
              <span className="text-[12px] text-muted">on the presentation</span>
            )}
            <span className="text-[11px] text-faint">{formatRelative(entry.submittedAt)}</span>
          </div>

          <blockquote className="mt-3 border-l-2 border-line pl-3 text-[13px] leading-relaxed text-ink">
            {entry.body}
          </blockquote>

          {!interpretation ? (
            <Button
              size="sm"
              variant="accent"
              className="mt-4"
              loading={interpreting}
              icon={interpreting ? undefined : <Sparkles size={13} />}
              onClick={onInterpret}
            >
              Interpret this feedback
            </Button>
          ) : null}
        </div>
      </div>

      {interpretation ? (
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="label-xs">Interpretation</p>
            {interpretationStatus === "approved" ? (
              <Badge tone="success">Confirmed</Badge>
            ) : interpretationStatus === "edited" ? (
              <Badge tone="accent">Edited by you</Badge>
            ) : (
              <Badge tone="caution">Awaiting your confirmation</Badge>
            )}
          </div>

          <p className="mb-4 text-[13px] leading-relaxed text-muted">{interpretation.summary}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label-xs mb-2">Preserve</p>
              <EditableList
                items={interpretation.positive}
                onSave={(positive) => onEdit({ positive })}
              />
            </div>
            <div>
              <p className="label-xs mb-2">Avoid</p>
              <EditableList
                tone="danger"
                items={interpretation.negative}
                onSave={(negative) => onEdit({ negative })}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="label-xs mb-2">Requested changes</p>
            <EditableList
              tone="accent"
              items={interpretation.requestedChanges}
              onSave={(requestedChanges) => onEdit({ requestedChanges })}
            />
          </div>

          {interpretation.ambiguities.length > 0 ? (
            <div className="mt-4 rounded-lg border border-caution/25 bg-caution/8 p-3">
              <p className="label-xs mb-2">Unclear — worth confirming with the client</p>
              <ul className="space-y-1">
                {interpretation.ambiguities.map((a, i) => (
                  <li key={i} className="text-[12px] leading-relaxed text-muted">
                    · {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {interpretation.suggestedActions.length > 0 ? (
            <div className="mt-4">
              <p className="label-xs mb-2">Suggested next steps</p>
              <ul className="space-y-1">
                {interpretation.suggestedActions.map((a, i) => (
                  <li key={i} className="text-[12px] leading-relaxed text-muted">
                    · {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {interpretationStatus !== "approved" ? (
              <Button size="sm" variant="accent" icon={<Check size={13} />} onClick={onApprove}>
                Confirm interpretation
              </Button>
            ) : (
              <Button size="sm" variant="accent" onClick={onRefine}>
                Refine the concept
              </Button>
            )}
            {onRecordApproval ? (
              <Button size="sm" variant="secondary" onClick={onRecordApproval}>
                Record as client approval
              </Button>
            ) : null}
          </div>

          {interpretationStatus !== "approved" ? (
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Nothing is generated from this until you confirm it. Edit any line above first —
              you know what the client meant better than the model does.
            </p>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
