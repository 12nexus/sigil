"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Columns3,
  Layers,
  Trophy,
} from "lucide-react";
import { AiNote } from "@/components/AiNote";
import { ConceptImage } from "@/components/ConceptImage";
import { Button } from "@/components/ui/Button";
import {
  Badge,
  EmptyState,
  Panel,
} from "@/components/ui/Primitives";
import { CompareModal } from "@/features/concepts/CompareModal";
import { ConceptDetail } from "@/features/concepts/ConceptDetail";
import { BatchProgress } from "@/features/exploration/BatchProgress";
import { StageHeader } from "@/features/workspace/StageHeader";
import { useBatchJob } from "@/hooks/useBatchJob";
import { useLoadedProject } from "@/hooks/useProject";
import { useToast } from "@/hooks/useToast";
import type { LockupKind, LogoConcept } from "@/types";
import {
  createLockupJob,
  FINALIST_LOCKUPS,
  LOCKUP_CONSISTENCY_NOTE,
  standardLockupInstruction,
} from "@/workflows/generation";
import { timelineEvent } from "@/workflows/projectFactory";
import { setConceptStatus, toggleClientVisible } from "@/workflows/mutations";
import { cn } from "@/utils/cn";

const LOCKUP_LABELS: Record<LockupKind, string> = {
  primary: "Primary",
  secondary: "Secondary",
  symbol: "Symbol",
  wordmark: "Wordmark",
  horizontal: "Horizontal",
  stacked: "Stacked",
  monochrome: "Monochrome",
  reversed: "Reversed",
  small: "Small size",
  favicon: "Favicon",
};

export function FinalistsStage() {
  const router = useRouter();
  const { project, update } = useLoadedProject();
  const { push } = useToast();
  const batch = useBatchJob(project.id);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  const finalists = useMemo(
    () =>
      project.finalistIds
        .map((id) => project.concepts.find((c) => c.id === id))
        .filter(Boolean) as LogoConcept[],
    [project.finalistIds, project.concepts],
  );

  const buildLockups = async (concept: LogoConcept) => {
    const lockups = FINALIST_LOCKUPS.map((kind) =>
      standardLockupInstruction(
        kind,
        concept,
        concept.typography.exactCompanyName || project.companyName,
      ),
    );
    const job = createLockupJob(
      project,
      concept,
      lockups,
      LOCKUP_CONSISTENCY_NOTE,
      "finalist_lockups",
    );
    const finished = await batch.start(job);
    const done = finished.items.filter((i) => i.status === "done").length;
    await update(
      (p) => p,
      timelineEvent(
        "generation",
        `${done} lockups built for ${concept.code}`,
        concept.name,
        "finalists",
      ),
    );
    push({ tone: "success", title: `${done} lockups generated for ${concept.code}` });
  };

  const approveForClient = async () => {
    await update(
      (p) => ({
        ...p,
        approvals: {
          ...p.approvals,
          designer: {
            approved: true,
            at: new Date().toISOString(),
            by: "designer",
            note: `${finalists.length} finalists approved for client presentation.`,
          },
        },
        stage: "client-review",
        clientReview: {
          ...p.clientReview,
          conceptOrder: p.finalistIds,
        },
        concepts: p.concepts.map((c) =>
          p.finalistIds.includes(c.id) ? { ...c, clientVisible: true } : c,
        ),
      }),
      timelineEvent(
        "decision",
        "Finalists approved for client review",
        `${finalists.length} concepts released to the client presentation.`,
        "finalists",
      ),
    );
    push({ tone: "success", title: "Approved — ready to present" });
    router.push(`/projects/${project.id}/client-review`);
  };

  if (finalists.length === 0) {
    return (
      <>
        <StageHeader stage="finalists" />
        <EmptyState
          icon={<Trophy size={26} />}
          title="No finalists yet"
          description="Promote two to four of your strongest concepts to finalist. Each one then gets built out into a full lockup family — symbol, wordmark, horizontal, stacked, monochrome, reversed, and small-size."
          action={
            <Button
              variant="accent"
              onClick={() => router.push(`/projects/${project.id}/refinement`)}
            >
              Back to refinement
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <StageHeader
        stage="finalists"
        action={
          <div className="flex flex-wrap gap-2">
            {finalists.length >= 2 ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<Columns3 size={13} />}
                onClick={() => setComparing(true)}
              >
                Compare
              </Button>
            ) : null}
            {!project.approvals.designer.approved ? (
              <Button
                variant="accent"
                size="sm"
                icon={<CheckCircle2 size={14} />}
                onClick={approveForClient}
              >
                Approve for client
              </Button>
            ) : (
              <Button
                variant="accent"
                size="sm"
                icon={<ArrowRight size={14} />}
                onClick={() => router.push(`/projects/${project.id}/client-review`)}
              >
                Client review
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-6">
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

        <AiNote
          tone="accent"
          did={`${finalists.length} concept${finalists.length === 1 ? "" : "s"} promoted to finalist.`}
          why="Finalist lockups are a reproduction exercise, not a design one. The instructions lock the approved geometry and vary only arrangement, colour, and scale — so the family stays consistent."
          next={
            project.approvals.designer.approved
              ? "Your approval is recorded. Publish the client presentation when you are ready."
              : "Build the lockups for each finalist, then approve the set for client presentation."
          }
        />

        {finalists.length > 4 ? (
          <Panel className="border-caution/25 !p-4">
            <p className="text-[12px] leading-relaxed text-muted">
              <span className="text-caution">{finalists.length} finalists.</span> Presenting
              more than four options tends to stall a client rather than help them decide —
              consider narrowing before you present.
            </p>
          </Panel>
        ) : null}

        <div className="space-y-5">
          {finalists.map((concept, index) => (
            <FinalistPanel
              key={concept.id}
              concept={concept}
              index={index}
              onOpen={() => setDetailId(concept.id)}
              onBuild={() => buildLockups(concept)}
              building={batch.running}
              onDemote={() =>
                update(
                  (p) => setConceptStatus(p, concept.id, "shortlisted"),
                  timelineEvent(
                    "decision",
                    `${concept.code} removed from finalists`,
                    undefined,
                    "finalists",
                  ),
                )
              }
              onToggleClientVisible={() =>
                update((p) => toggleClientVisible(p, concept.id), null)
              }
            />
          ))}
        </div>

        <Panel className="flex flex-wrap items-center justify-between gap-4 border-accent/20">
          <div className="min-w-0">
            <h3 className="text-[14px] text-ink">
              {project.approvals.designer.approved
                ? "Approved for client presentation"
                : "Ready to present?"}
            </h3>
            <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted">
              {project.approvals.designer.approved
                ? `You approved these on ${new Date(project.approvals.designer.at!).toLocaleString()}. This is your approval — separate from the client's.`
                : "Approving here records your own sign-off and opens the client presentation. It is not the client's approval, and it is not final approval."}
            </p>
          </div>
          {project.approvals.designer.approved ? (
            <Button
              variant="accent"
              icon={<ArrowRight size={14} />}
              onClick={() => router.push(`/projects/${project.id}/client-review`)}
            >
              Go to client review
            </Button>
          ) : (
            <Button
              variant="accent"
              icon={<CheckCircle2 size={14} />}
              onClick={approveForClient}
            >
              Approve for client presentation
            </Button>
          )}
        </Panel>
      </div>

      {detailId ? (
        <ConceptDetail conceptId={detailId} onClose={() => setDetailId(null)} onNavigate={setDetailId} />
      ) : null}

      {comparing ? (
        <CompareModal
          conceptIds={finalists.map((f) => f.id)}
          onClose={() => setComparing(false)}
        />
      ) : null}
    </>
  );
}

function FinalistPanel({
  concept,
  index,
  onOpen,
  onBuild,
  building,
  onDemote,
  onToggleClientVisible,
}: {
  concept: LogoConcept;
  index: number;
  onOpen: () => void;
  onBuild: () => void;
  building: boolean;
  onDemote: () => void;
  onToggleClientVisible: () => void;
}) {
  const lockups = FINALIST_LOCKUPS.map((kind) => ({
    kind,
    asset: concept.assets.find((a) => a.kind === kind),
  }));
  const built = lockups.filter((l) => l.asset).length;

  return (
    <Panel>
      <div className="flex flex-wrap items-start gap-5">
        <button type="button" onClick={onOpen} className="shrink-0">
          <ConceptImage
            assetId={concept.primaryAssetId}
            alt={concept.name}
            className="h-36 w-36"
            imgClassName="p-3"
          />
        </button>

        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">Finalist {index + 1}</Badge>
            <span className="font-mono text-[11px] text-faint">{concept.code}</span>
            <h3 className="text-[16px] text-ink">{concept.name}</h3>
          </div>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-muted">
            {concept.rationale}
          </p>

          {!concept.typography.renderedTextVerified ? (
            <p className="mt-2 text-[11px] leading-relaxed text-caution">
              The wordmark in this artwork has not been verified. Check it under Typography
              before presenting — image models corrupt letterforms routinely.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={built > 0 ? "secondary" : "accent"}
              icon={<Layers size={13} />}
              onClick={onBuild}
              disabled={building}
            >
              {built > 0 ? "Rebuild lockups" : "Build lockup family"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onOpen}>
              Open concept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleClientVisible}
              className={concept.clientVisible ? "text-accent" : undefined}
            >
              {concept.clientVisible ? "Visible to client" : "Hidden from client"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDemote}>
              Remove
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="label-xs">
            Lockup family · {built} of {FINALIST_LOCKUPS.length} built
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {lockups.map(({ kind, asset }) => (
            <div key={kind} className="min-w-0">
              {asset ? (
                <ConceptImage
                  assetId={asset.assetId}
                  alt={`${concept.name} ${kind}`}
                  dark={kind === "reversed"}
                  imgClassName="p-2"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-line bg-surface-2">
                  <span className="text-[10px] text-faint">Not built</span>
                </div>
              )}
              <p
                className={cn(
                  "mt-1.5 truncate text-center text-[10px]",
                  asset ? "text-muted" : "text-faint",
                )}
              >
                {LOCKUP_LABELS[kind]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
