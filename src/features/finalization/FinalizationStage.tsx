"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Layers, ShieldCheck } from "lucide-react";
import { AiNote } from "@/components/AiNote";
import { ConceptImage } from "@/components/ConceptImage";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Field";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Panel,
} from "@/components/ui/Primitives";
import { BatchProgress } from "@/features/exploration/BatchProgress";
import { StageHeader } from "@/features/workspace/StageHeader";
import { useBatchJob } from "@/hooks/useBatchJob";
import { useLoadedProject } from "@/hooks/useProject";
import { resolveGenerationSettings, useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/useToast";
import { generateFinalizationInstructions } from "@/services/gemini";
import { GeminiError } from "@/services/gemini/errors";
import type { FinalizationPlan, GeminiErrorCode, LockupKind } from "@/types";
import { createLockupJob, DELIVERY_LOCKUPS, LOCKUP_CONSISTENCY_NOTE, standardLockupInstruction } from "@/workflows/generation";
import { setConceptStatus } from "@/workflows/mutations";
import { timelineEvent } from "@/workflows/projectFactory";
import { toList } from "@/utils/format";

const DEFAULT_PLAN: FinalizationPlan = {
  colorStrategy: "new_palette",
  existingColors: [],
  needsTypographyPairing: true,
  needsSpacingRules: true,
  needsMinimumSize: true,
  needsUsageGuidelines: true,
  additionalNotes: "",
};

export function FinalizationStage() {
  const router = useRouter();
  const { project, update } = useLoadedProject();
  const { settings } = useSettings();
  const { push } = useToast();
  const batch = useBatchJob(project.id);
  const generationSettings = resolveGenerationSettings(settings, project);

  const [plan, setPlan] = useState<FinalizationPlan>(project.finalization ?? DEFAULT_PLAN);
  const [colorsDraft, setColorsDraft] = useState(plan.existingColors.join(", "));
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<{ message: string; code: GeminiErrorCode } | null>(null);

  const approvedConcept = useMemo(() => {
    const id = project.approvals.final.conceptId ?? project.approvals.client.conceptId;
    return project.concepts.find((c) => c.id === id);
  }, [project.approvals, project.concepts]);

  const finalApproved = project.approvals.final.approved;

  const savePlan = (patch: Partial<FinalizationPlan>) => {
    const next = { ...plan, ...patch };
    setPlan(next);
    void update((p) => ({ ...p, finalization: next }), null);
  };

  const giveFinalApproval = async () => {
    if (!approvedConcept) return;
    const confirmed: FinalizationPlan = {
      ...plan,
      existingColors: toList(colorsDraft),
      confirmedAt: new Date().toISOString(),
    };
    await update(
      (p) => ({
        ...setConceptStatus(p, approvedConcept.id, "approved"),
        finalization: confirmed,
        status: "finalized",
        approvals: {
          ...p.approvals,
          final: {
            approved: true,
            conceptId: approvedConcept.id,
            at: new Date().toISOString(),
            by: "designer",
            note: "Final approval — the identity is locked.",
          },
        },
      }),
      timelineEvent(
        "decision",
        "Final approval given",
        `${approvedConcept.code} — ${approvedConcept.name} is the final mark.`,
        "finalization",
      ),
    );
    setPlan(confirmed);
    push({ tone: "success", title: "Final approval recorded" });
  };

  const buildSystem = async () => {
    if (!approvedConcept) return;
    setBuilding(true);
    setError(null);
    try {
      let lockups: Array<{ kind: LockupKind; instruction: string; purpose: string }>;

      try {
        // Ask Gemini to write instructions tailored to this specific mark and
        // the designer's finalization choices.
        const instructions = await generateFinalizationInstructions(
          project,
          approvedConcept,
          { ...plan, existingColors: toList(colorsDraft) },
          generationSettings,
        );
        lockups = instructions.lockups;
      } catch {
        // If that fails, the standard instruction set still produces a complete,
        // consistent system — finalization should not be blocked by one call.
        lockups = DELIVERY_LOCKUPS.map((kind) =>
          standardLockupInstruction(
            kind,
            approvedConcept,
            approvedConcept.typography.exactCompanyName || project.companyName,
          ),
        );
      }

      const job = createLockupJob(
        project,
        approvedConcept,
        lockups,
        LOCKUP_CONSISTENCY_NOTE,
        "delivery_assets",
      );
      const finished = await batch.start(job);
      const done = finished.items.filter((i) => i.status === "done").length;

      await update(
        (p) => ({ ...p, stage: "delivery" }),
        timelineEvent(
          "generation",
          `${done} final logo assets generated`,
          approvedConcept.name,
          "finalization",
        ),
      );
      push({ tone: "success", title: `${done} final assets generated` });
    } catch (err) {
      const geminiError = GeminiError.from(err);
      setError({ message: geminiError.message, code: geminiError.code });
    } finally {
      setBuilding(false);
    }
  };

  if (!approvedConcept) {
    return (
      <>
        <StageHeader stage="finalization" />
        <EmptyState
          icon={<ShieldCheck size={26} />}
          title="No approved concept"
          description="Finalization works on the concept the client approved. Record the client's approval first."
          action={
            <Button
              variant="accent"
              onClick={() => router.push(`/projects/${project.id}/client-review`)}
            >
              Back to client review
            </Button>
          }
        />
      </>
    );
  }

  const builtAssets = approvedConcept.assets.filter((a) => a.kind !== "primary").length;

  return (
    <>
      <StageHeader
        stage="finalization"
        action={
          finalApproved ? (
            <Button
              variant="accent"
              size="sm"
              icon={<ArrowRight size={14} />}
              onClick={() => router.push(`/projects/${project.id}/delivery`)}
            >
              Delivery
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {error ? (
          <ErrorNotice
            title="Could not build the logo system"
            message={error.message}
            code={error.code}
            onRetry={buildSystem}
            onDismiss={() => setError(null)}
          />
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

        {/* Approval chain — the three approvals are deliberately distinct. */}
        <Panel>
          <h2 className="mb-4 text-[14px] text-ink">Approval chain</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <ApprovalTile
              label="Your approval"
              approved={project.approvals.designer.approved}
              at={project.approvals.designer.at}
              note="You released the finalists for presentation."
            />
            <ApprovalTile
              label="Client approval"
              approved={project.approvals.client.approved}
              at={project.approvals.client.at}
              note="The client chose this concept."
            />
            <ApprovalTile
              label="Final approval"
              approved={finalApproved}
              at={project.approvals.final.at}
              note="The identity is locked and the project is finalized."
            />
          </div>
        </Panel>

        {/* The approved mark */}
        <Panel>
          <div className="flex flex-wrap items-center gap-5">
            <ConceptImage
              assetId={approvedConcept.primaryAssetId}
              alt={approvedConcept.name}
              className="h-32 w-32 shrink-0"
              imgClassName="p-3"
            />
            <div className="min-w-[240px] flex-1">
              <Badge tone="success">Approved mark</Badge>
              <h2 className="mt-2 text-[20px] text-ink">{approvedConcept.name}</h2>
              <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-muted">
                {approvedConcept.rationale}
              </p>
              <p className="mt-2 text-[12px] text-muted">
                Wordmark will be set as{" "}
                <span className="text-ink">
                  {approvedConcept.typography.exactCompanyName || project.companyName}
                </span>
              </p>
            </div>
          </div>
        </Panel>

        {/* Finalization options */}
        <Panel>
          <h2 className="text-[14px] text-ink">Finalization options</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            These decide what the brand kit contains and how the final assets are built.
          </p>

          <div className="mt-5 space-y-5">
            <div>
              <p className="label-xs mb-2">Colour</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["retain_existing", "Keep existing brand colours"],
                    ["new_palette", "Design a new palette"],
                    ["hybrid", "Extend existing colours"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={finalApproved}
                    onClick={() => savePlan({ colorStrategy: value })}
                    className={
                      plan.colorStrategy === value
                        ? "rounded-lg border border-accent/50 bg-accent/10 px-3 py-2.5 text-left text-[12px] text-accent"
                        : "rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-left text-[12px] text-muted transition-colors hover:border-line-strong disabled:opacity-50"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {plan.colorStrategy !== "new_palette" ? (
              <Field label="Existing brand colours" hint="Comma separated hex values">
                <Input
                  value={colorsDraft}
                  disabled={finalApproved}
                  onChange={(e) => setColorsDraft(e.target.value)}
                  onBlur={() => savePlan({ existingColors: toList(colorsDraft) })}
                  placeholder="#16161C, #C8102E"
                />
              </Field>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox
                checked={plan.needsTypographyPairing}
                onChange={(v) => savePlan({ needsTypographyPairing: v })}
                label="Typography pairing"
                hint="Recommend a display and text face for the brand system"
              />
              <Checkbox
                checked={plan.needsSpacingRules}
                onChange={(v) => savePlan({ needsSpacingRules: v })}
                label="Clear space rules"
                hint="Define exclusion zone relative to the mark"
              />
              <Checkbox
                checked={plan.needsMinimumSize}
                onChange={(v) => savePlan({ needsMinimumSize: v })}
                label="Minimum sizes"
                hint="Concrete floors for digital and print"
              />
              <Checkbox
                checked={plan.needsUsageGuidelines}
                onChange={(v) => savePlan({ needsUsageGuidelines: v })}
                label="Usage guidelines"
                hint="Do and don't rules for other people applying the mark"
              />
            </div>

            <Field label="Anything else the brand kit must cover?" hint="Optional">
              <Textarea
                rows={2}
                value={plan.additionalNotes}
                disabled={finalApproved}
                onChange={(e) => setPlan({ ...plan, additionalNotes: e.target.value })}
                onBlur={() => savePlan({ additionalNotes: plan.additionalNotes })}
                placeholder="They print on kraft packaging — the palette needs to hold up on brown stock."
              />
            </Field>
          </div>
        </Panel>

        {/* Final approval */}
        {!finalApproved ? (
          <Panel className="border-accent/25">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-[14px] text-ink">Give final approval</h3>
                <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted">
                  This locks the identity and marks the project finalized. It is distinct from
                  your earlier sign-off and from the client&apos;s — only this one closes the
                  project. You can still reopen earlier stages afterwards.
                </p>
              </div>
              <Button variant="accent" icon={<ShieldCheck size={14} />} onClick={giveFinalApproval}>
                Approve as final
              </Button>
            </div>
          </Panel>
        ) : (
          <Panel className="border-success/25">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-[14px] text-ink">
                  <Check size={15} className="text-success" />
                  Final approval recorded
                </h3>
                <p className="mt-1 text-[12px] text-muted">
                  {new Date(project.approvals.final.at!).toLocaleString()} ·{" "}
                  {builtAssets > 0
                    ? `${builtAssets} final assets built`
                    : "Build the full logo system next"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={builtAssets > 0 ? "secondary" : "accent"}
                  icon={<Layers size={14} />}
                  onClick={buildSystem}
                  loading={building || batch.running}
                >
                  {builtAssets > 0 ? "Rebuild logo system" : "Build the logo system"}
                </Button>
                {builtAssets > 0 ? (
                  <Button
                    variant="accent"
                    icon={<ArrowRight size={14} />}
                    onClick={() => router.push(`/projects/${project.id}/delivery`)}
                  >
                    Delivery
                  </Button>
                ) : null}
              </div>
            </div>
          </Panel>
        )}

        <AiNote
          tone="accent"
          did="Finalization reproduces the approved mark across the full system — it never redesigns it."
          why="Each lockup instruction restates the mark's construction and locks its geometry, so the family stays internally consistent."
          next={
            finalApproved
              ? "Build the system, then export the brand kit from Delivery."
              : "Set the options above, then give final approval."
          }
        />

        {/* Honest disclosure about what these files actually are. */}
        <Panel className="border-caution/25">
          <h3 className="text-[13px] text-ink">About the final files</h3>
          <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-muted">
            Every asset SIGIL produces is an AI-generated raster image. They are genuinely
            useful for presentation, comping, and digital use — but they are not production
            vector artwork, and SIGIL will not pretend otherwise. Before rollout, the approved
            mark should be redrawn as true vector by a designer working from these files as
            reference. Colour values, typography recommendations, and usage rules in the brand
            kit are production-ready as written.
          </p>
        </Panel>
      </div>
    </>
  );
}

function ApprovalTile({
  label,
  approved,
  at,
  note,
}: {
  label: string;
  approved: boolean;
  at?: string;
  note: string;
}) {
  return (
    <div
      className={
        approved
          ? "rounded-lg border border-success/30 bg-success/8 p-3.5"
          : "rounded-lg border border-line bg-surface-2 p-3.5"
      }
    >
      <div className="flex items-center gap-2">
        {approved ? (
          <Check size={13} className="text-success" />
        ) : (
          <span className="h-3 w-3 rounded-full border border-line" />
        )}
        <span className="text-[12px] text-ink">{label}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-faint">
        {approved && at ? new Date(at).toLocaleString() : note}
      </p>
    </div>
  );
}
