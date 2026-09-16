"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Layers, Play, RotateCcw, Sparkles } from "lucide-react";
import { AiNote } from "@/components/AiNote";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import {
  Badge,
  ErrorNotice,
  Modal,
  Panel,
} from "@/components/ui/Primitives";
import { ConceptLibrary } from "@/features/concepts/ConceptLibrary";
import { IterateModal } from "@/features/concepts/IterateModal";
import { StageHeader } from "@/features/workspace/StageHeader";
import { useBatchJob } from "@/hooks/useBatchJob";
import { useLoadedProject } from "@/hooks/useProject";
import { resolveGenerationSettings, useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/useToast";
import { GeminiError } from "@/services/gemini/errors";
import type { GeminiErrorCode, GenerationJob } from "@/types";
import { createExplorationJob, planExploration } from "@/workflows/generation";
import { timelineEvent } from "@/workflows/projectFactory";
import { BatchProgress } from "./BatchProgress";

export function ExplorationStage() {
  const router = useRouter();
  const { project, update } = useLoadedProject();
  const { settings, keyConfigured } = useSettings();
  const { push } = useToast();
  const batch = useBatchJob(project.id);

  const generationSettings = resolveGenerationSettings(settings, project);

  const [setupOpen, setSetupOpen] = useState(false);
  const [perDirection, setPerDirection] = useState(
    generationSettings.defaultConceptsPerDirection,
  );
  const [guidance, setGuidance] = useState("");
  const [planning, setPlanning] = useState(false);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code: GeminiErrorCode } | null>(null);
  const [iterateId, setIterateId] = useState<string | null>(null);

  const approvedDirections = useMemo(
    () => project.directions.filter((d) => d.status === "approved"),
    [project.directions],
  );

  const originals = useMemo(
    () => project.concepts.filter((c) => c.iterationNumber === 0),
    [project.concepts],
  );

  const total = approvedDirections.length * perDirection;

  /* ---------------------------- generation ---------------------------- */

  const runExploration = async () => {
    if (!keyConfigured) {
      setError({ message: "No Gemini API key is configured.", code: "MISSING_KEY" });
      return;
    }
    setSetupOpen(false);
    setPlanning(true);
    setError(null);

    try {
      setPlanStatus("Designing concepts for each territory…");

      const outcome = await planExploration(
        project,
        approvedDirections,
        perDirection,
        generationSettings,
        {
          guidance: guidance.trim() || undefined,
          onDirectionPlanned: (direction) =>
            setPlanStatus(`Planned concepts for "${direction.name}"…`),
        },
      );

      if (outcome.failures.length) {
        push({
          tone: "error",
          title: `Planning failed for ${outcome.failures.length} direction${outcome.failures.length === 1 ? "" : "s"}`,
          body: outcome.failures.map((f) => `${f.direction.name}: ${f.message}`).join(" · "),
        });
      }

      if (!outcome.planned.length) {
        setError({
          message: "Gemini could not plan any concepts for the approved directions.",
          code: "INVALID_OUTPUT",
        });
        return;
      }

      await update(
        (p) => ({ ...p, stage: "exploration" }),
        timelineEvent(
          "ai",
          `${outcome.planned.length} concepts planned`,
          `Across ${approvedDirections.length} approved territor${approvedDirections.length === 1 ? "y" : "ies"}.`,
          "exploration",
        ),
      );

      setPlanStatus(null);
      const job = createExplorationJob(project, outcome.planned);
      const finished = await batch.start(job);

      const done = finished.items.filter((i) => i.status === "done").length;
      await update(
        (p) => p,
        timelineEvent(
          "generation",
          `${done} logo concepts generated`,
          finished.status === "completed_with_errors"
            ? `${finished.items.length - done} failed and can be retried individually.`
            : undefined,
          "exploration",
        ),
      );
      push({
        tone: done > 0 ? "success" : "error",
        title: `${done} concepts generated`,
        body: done > 0 ? "Review them below and shortlist what interests you." : undefined,
      });
    } catch (err) {
      const geminiError = GeminiError.from(err);
      setError({ message: geminiError.message, code: geminiError.code });
    } finally {
      setPlanning(false);
      setPlanStatus(null);
    }
  };

  const startIterationJob = async (job: GenerationJob) => {
    await batch.start(job);
    push({ tone: "success", title: "Variations generated" });
  };

  /* ------------------------------ guards ------------------------------ */

  if (approvedDirections.length === 0) {
    return (
      <>
        <StageHeader stage="exploration" />
        <Panel className="text-center">
          <Layers size={26} className="mx-auto mb-4 text-faint" />
          <h2 className="text-base text-ink">No approved creative territories</h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted">
            Exploration generates concepts inside the territories you approve. Go back and
            approve at least one.
          </p>
          <Button
            variant="accent"
            className="mt-5"
            onClick={() => router.push(`/projects/${project.id}/directions`)}
          >
            Review creative directions
          </Button>
        </Panel>
      </>
    );
  }

  /* -------------------------------- view ------------------------------ */

  return (
    <>
      <StageHeader
        stage="exploration"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={project.concepts.length ? "secondary" : "accent"}
              size="sm"
              icon={<Sparkles size={14} />}
              onClick={() => setSetupOpen(true)}
              loading={planning}
              disabled={batch.running}
            >
              {project.concepts.length ? "Generate more" : "Generate concepts"}
            </Button>
            {originals.length > 0 ? (
              <Button
                variant="accent"
                size="sm"
                icon={<ArrowRight size={14} />}
                onClick={() => {
                  void update((p) => ({ ...p, stage: "selection" }));
                  router.push(`/projects/${project.id}/selection`);
                }}
              >
                Curate
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="space-y-6">
        {error ? (
          <ErrorNotice
            title="Generation could not start"
            message={error.message}
            code={error.code}
            onRetry={runExploration}
            onDismiss={() => setError(null)}
          />
        ) : null}

        {planning && planStatus ? (
          <Panel className="border-violet/25">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-violet" />
              <p className="text-[13px] text-ink">{planStatus}</p>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Concepts are designed in language first, so each one is a genuinely different
              idea before any image is requested. No images are being generated yet.
            </p>
          </Panel>
        ) : null}

        {batch.job && batch.progress ? (
          <BatchProgress
            job={batch.job}
            progress={batch.progress}
            onCancel={batch.cancel}
            onPause={batch.pause}
            onResume={() => batch.resume(batch.job!)}
            onRetryItem={batch.retryItem}
            onRetryFailed={batch.retryFailed}
            onDismiss={batch.dismiss}
          />
        ) : null}

        {/* Unfinished work from a previous session. */}
        {!batch.job && batch.resumable.length > 0 ? (
          <Panel className="flex flex-wrap items-center justify-between gap-4 border-caution/25">
            <div>
              <p className="text-[13px] text-ink">
                An unfinished generation run was found from a previous session
              </p>
              <p className="mt-1 text-[12px] text-muted">
                {batch.resumable[0].title} —{" "}
                {batch.resumable[0].items.filter((i) => i.status === "done").length} of{" "}
                {batch.resumable[0].items.length} completed. Everything already generated was
                kept.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={<RotateCcw size={13} />}
              onClick={() => batch.resume(batch.resumable[0])}
            >
              Resume
            </Button>
          </Panel>
        ) : null}

        {project.concepts.length > 0 ? (
          <AiNote
            did={`Gemini generated ${project.concepts.length} logo concept${project.concepts.length === 1 ? "" : "s"} across ${approvedDirections.length} approved territor${approvedDirections.length === 1 ? "y" : "ies"}.`}
            why="Each concept inside a territory was designed to be a different construction, not a restyling — so the exploration covers real design space."
            next="Favourite what interests you, reject what does not, and shortlist the concepts worth developing. Rejections are remembered and shape everything generated afterwards."
          />
        ) : null}

        {approvedDirections.length > 0 && project.concepts.length === 0 && !planning ? (
          <Panel>
            <h3 className="text-[14px] text-ink">Ready to explore</h3>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-muted">
              SIGIL will generate {perDirection} conceptually distinct marks inside each of
              your {approvedDirections.length} approved territories — {total} concepts in
              total — in one run. You can pause, cancel, or retry individual failures at any
              point, and nothing that finishes is ever lost.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {approvedDirections.map((d) => (
                <Badge key={d.id} tone="accent">
                  {d.number}. {d.name}
                </Badge>
              ))}
            </div>
            <Button
              variant="accent"
              className="mt-5"
              icon={<Play size={14} />}
              onClick={() => setSetupOpen(true)}
            >
              Generate {total} concepts
            </Button>
          </Panel>
        ) : null}

        <ConceptLibrary
          concepts={project.concepts}
          onIterate={setIterateId}
          emptyTitle="No concepts generated yet"
          emptyDescription="Start a generation run to fill the library."
        />
      </div>

      {/* Setup */}
      <Modal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        title="Generate logo concepts"
        description={`${approvedDirections.length} approved territor${approvedDirections.length === 1 ? "y" : "ies"} will be explored.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSetupOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" icon={<Play size={14} />} onClick={runExploration}>
              Generate {total} concepts
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Concepts per territory" hint="5–8 gives real breadth">
            <Input
              type="number"
              min={1}
              max={12}
              value={perDirection}
              onChange={(e) =>
                setPerDirection(Math.max(1, Math.min(12, Number(e.target.value) || 6)))
              }
            />
          </Field>

          <Field label="Any steer for this batch?" hint="Optional">
            <Textarea
              rows={3}
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="Lean heavier — everything so far feels too delicate for embroidery."
            />
          </Field>

          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-[12px] text-ink">{total} images will be generated</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {generationSettings.batchConcurrency} at a time using{" "}
              {generationSettings.imageModel}, with up to {generationSettings.maxRetries}{" "}
              automatic retries each. Expect roughly{" "}
              {Math.ceil((total / generationSettings.batchConcurrency) * 12)} seconds.
            </p>
          </div>
        </div>
      </Modal>

      {iterateId ? (
        <IterateModal
          conceptId={iterateId}
          onClose={() => setIterateId(null)}
          onStart={startIterationJob}
        />
      ) : null}
    </>
  );
}
