"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, Plus, RefreshCw, Sparkles } from "lucide-react";
import { AiNote } from "@/components/AiNote";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Modal,
  Panel,
} from "@/components/ui/Primitives";
import { StageHeader } from "@/features/workspace/StageHeader";
import { useLoadedProject } from "@/hooks/useProject";
import { resolveGenerationSettings, useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/useToast";
import { generateCreativeDirections } from "@/services/gemini";
import { GeminiError } from "@/services/gemini/errors";
import type { CreativeDirection, GeminiErrorCode } from "@/types";
import {
  commentOnDirection,
  makeComment,
  setDirectionStatus,
  toggleDirectionFavorite,
  updateDirection,
} from "@/workflows/mutations";
import { timelineEvent } from "@/workflows/projectFactory";
import { newId } from "@/utils/id";
import { DirectionCard } from "./DirectionCard";

export function DirectionsStage() {
  const router = useRouter();
  const { project, update } = useLoadedProject();
  const { settings, keyConfigured } = useSettings();
  const { push } = useToast();

  const generationSettings = resolveGenerationSettings(settings, project);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<{ message: string; code: GeminiErrorCode } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [count, setCount] = useState(generationSettings.defaultDirectionCount);
  const [guidance, setGuidance] = useState("");
  const [approachNote, setApproachNote] = useState<string | null>(null);

  const directions = project.directions;
  const approved = useMemo(
    () => directions.filter((d) => d.status === "approved"),
    [directions],
  );
  const rejected = useMemo(
    () => directions.filter((d) => d.status === "rejected"),
    [directions],
  );
  const undecided = useMemo(() => directions.filter((d) => d.status === "new"), [directions]);

  const generate = async (append: boolean) => {
    if (!keyConfigured) {
      setError({ message: "No Gemini API key is configured.", code: "MISSING_KEY" });
      return;
    }
    setGenerating(true);
    setError(null);
    setShowMore(false);
    try {
      const result = await generateCreativeDirections(
        project,
        generationSettings,
        count,
        guidance.trim() || undefined,
      );

      const startNumber = append
        ? Math.max(0, ...directions.map((d) => d.number)) + 1
        : 1;

      const fresh: CreativeDirection[] = result.directions.map((d, i) => ({
        ...d,
        id: newId("dir"),
        number: startNumber + i,
        status: "new",
        favorite: false,
        comments: [],
        editedByUser: false,
        createdAt: new Date().toISOString(),
      }));

      await update(
        (p) => ({
          ...p,
          directions: append ? [...p.directions, ...fresh] : fresh,
          directionsGeneratedAt: new Date().toISOString(),
          stage: "directions",
        }),
        timelineEvent(
          "ai",
          `${fresh.length} creative direction${fresh.length === 1 ? "" : "s"} generated`,
          append
            ? "Added alongside the existing territories."
            : "Distinct creative territories developed from the approved brief.",
          "directions",
        ),
      );
      setApproachNote(result.approachNote);
      setGuidance("");
      push({ tone: "success", title: `${fresh.length} territories ready for review` });
    } catch (err) {
      const geminiError = GeminiError.from(err);
      setError({ message: geminiError.message, code: geminiError.code });
    } finally {
      setGenerating(false);
    }
  };

  const decide = async (direction: CreativeDirection, status: CreativeDirection["status"]) => {
    await update(
      (p) => setDirectionStatus(p, direction.id, status),
      status === "new"
        ? null
        : timelineEvent(
            "decision",
            `Direction ${direction.number} ${status}`,
            `${direction.name}${status === "rejected" ? " — added to design memory as a constraint" : ""}`,
            "directions",
          ),
    );
  };

  const proceed = async () => {
    await update((p) => ({ ...p, stage: "exploration" }));
    router.push(`/projects/${project.id}/exploration`);
  };

  /* ------------------------------ empty ------------------------------ */

  if (directions.length === 0) {
    return (
      <>
        <StageHeader stage="directions" />
        {error ? (
          <ErrorNotice
            className="mb-6"
            title="Could not generate directions"
            message={error.message}
            code={error.code}
            onRetry={() => generate(false)}
            onDismiss={() => setError(null)}
          />
        ) : null}
        <EmptyState
          icon={<Compass size={26} />}
          title="No creative territories yet"
          description="Gemini will develop fundamentally different creative territories from your approved brief — not colour variations of one idea, but genuinely different answers to the same strategic problem. No artwork is generated at this stage."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="accent"
                onClick={() => generate(false)}
                loading={generating}
                icon={<Sparkles size={14} />}
              >
                {generating ? "Developing territories" : `Develop ${count} directions`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowMore(true)}>
                Options
              </Button>
            </div>
          }
        />
        <OptionsModal
          open={showMore}
          onClose={() => setShowMore(false)}
          count={count}
          setCount={setCount}
          guidance={guidance}
          setGuidance={setGuidance}
          onGenerate={() => generate(false)}
          loading={generating}
        />
      </>
    );
  }

  /* --------------------------- directions ---------------------------- */

  return (
    <>
      <StageHeader
        stage="directions"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => setShowMore(true)}
            >
              More directions
            </Button>
            {approved.length > 0 ? (
              <Button
                variant="accent"
                size="sm"
                icon={<ArrowRight size={14} />}
                onClick={proceed}
              >
                Generate logos from {approved.length} direction
                {approved.length === 1 ? "" : "s"}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="space-y-6">
        {error ? (
          <ErrorNotice
            title="Could not generate directions"
            message={error.message}
            code={error.code}
            onRetry={() => generate(true)}
            onDismiss={() => setError(null)}
          />
        ) : null}

        <AiNote
          did={`Gemini identified ${directions.length} distinct creative territories based on your approved brand brief.`}
          why={
            approachNote ??
            "Each territory is a different idea rather than a different styling of the same idea — that is what makes the exploration that follows cover real design space."
          }
          next={
            undecided.length > 0
              ? `Approve the territories worth exploring and reject the rest. ${undecided.length} still undecided.`
              : approved.length > 0
                ? "Generate logo concepts from your approved territories."
                : "Every territory is rejected — approve at least one, or generate a fresh set."
          }
        />

        {/* Decision summary */}
        {(approved.length > 0 || rejected.length > 0) && (
          <Panel className="!p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <Badge tone="success">Approved {approved.length}</Badge>
                <span className="text-[12px] text-muted">
                  {approved.map((d) => d.number).join(", ") || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="danger">Rejected {rejected.length}</Badge>
                <span className="text-[12px] text-muted">
                  {rejected.map((d) => d.number).join(", ") || "—"}
                </span>
              </div>
              {rejected.length > 0 ? (
                <p className="text-[11px] leading-relaxed text-faint">
                  Rejections are remembered — later generations will stay out of those
                  territories.
                </p>
              ) : null}
            </div>
          </Panel>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {directions.map((direction) => (
            <DirectionCard
              key={direction.id}
              direction={direction}
              onApprove={() => decide(direction, "approved")}
              onReject={() => decide(direction, "rejected")}
              onReset={() => decide(direction, "new")}
              onFavorite={() => update((p) => toggleDirectionFavorite(p, direction.id), null)}
              onComment={(body) =>
                update(
                  (p) => commentOnDirection(p, direction.id, makeComment(body)),
                  null,
                )
              }
              onEdit={(patch) => update((p) => updateDirection(p, direction.id, patch), null)}
            />
          ))}
        </div>

        {approved.length > 0 ? (
          <Panel className="flex flex-wrap items-center justify-between gap-4 border-accent/20">
            <div className="min-w-0">
              <h3 className="text-[14px] text-ink">
                {approved.length} territor{approved.length === 1 ? "y" : "ies"} approved
              </h3>
              <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted">
                Exploration will generate {generationSettings.defaultConceptsPerDirection}{" "}
                conceptually distinct marks inside each one —{" "}
                {approved.length * generationSettings.defaultConceptsPerDirection} concepts in
                total. You can change the count on the next screen.
              </p>
            </div>
            <Button variant="accent" icon={<ArrowRight size={14} />} onClick={proceed}>
              Go to exploration
            </Button>
          </Panel>
        ) : null}
      </div>

      <OptionsModal
        open={showMore}
        onClose={() => setShowMore(false)}
        count={count}
        setCount={setCount}
        guidance={guidance}
        setGuidance={setGuidance}
        onGenerate={() => generate(true)}
        loading={generating}
        append
      />
    </>
  );
}

function OptionsModal({
  open,
  onClose,
  count,
  setCount,
  guidance,
  setGuidance,
  onGenerate,
  loading,
  append,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  setCount: (n: number) => void;
  guidance: string;
  setGuidance: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
  append?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={append ? "Develop more territories" : "Direction options"}
      description={
        append
          ? "New territories are added alongside the existing ones. Nothing already generated is replaced."
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={onGenerate}
            loading={loading}
            icon={<RefreshCw size={13} />}
          >
            Generate {count}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="How many territories?" hint="6–10 is the useful range">
          <Input
            type="number"
            min={2}
            max={14}
            value={count}
            onChange={(e) => setCount(Math.max(2, Math.min(14, Number(e.target.value) || 8)))}
          />
        </Field>
        <Field
          label="Any steer for this round?"
          hint="Optional"
        >
          <Textarea
            rows={3}
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="Push harder on typographic and monogram territories — the client keeps gravitating to letterforms."
          />
        </Field>
      </div>
    </Modal>
  );
}
