"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, Trophy } from "lucide-react";
import { AiNote } from "@/components/AiNote";
import { ConceptImage } from "@/components/ConceptImage";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, Panel, Tabs } from "@/components/ui/Primitives";
import { ConceptDetail } from "@/features/concepts/ConceptDetail";
import { ConceptLibrary } from "@/features/concepts/ConceptLibrary";
import { IterateModal } from "@/features/concepts/IterateModal";
import { VersionTree } from "@/features/concepts/VersionTree";
import { BatchProgress } from "@/features/exploration/BatchProgress";
import { StageHeader } from "@/features/workspace/StageHeader";
import { useBatchJob } from "@/hooks/useBatchJob";
import { useLoadedProject } from "@/hooks/useProject";
import { useToast } from "@/hooks/useToast";
import type { GenerationJob } from "@/types";
import { setConceptStatus } from "@/workflows/mutations";
import { timelineEvent } from "@/workflows/projectFactory";

export function RefinementStage() {
  const router = useRouter();
  const { project, update } = useLoadedProject();
  const { push } = useToast();
  const batch = useBatchJob(project.id);

  const [view, setView] = useState<"shortlist" | "all" | "tree">("shortlist");
  const [iterateId, setIterateId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const shortlisted = useMemo(
    () =>
      project.concepts.filter(
        (c) => c.status === "shortlisted" || c.status === "finalist" || c.status === "approved",
      ),
    [project.concepts],
  );

  const iterations = useMemo(
    () => project.concepts.filter((c) => c.iterationNumber > 0),
    [project.concepts],
  );

  const promote = async (conceptId: string) => {
    const concept = project.concepts.find((c) => c.id === conceptId);
    await update(
      (p) => setConceptStatus(p, conceptId, "finalist"),
      timelineEvent(
        "decision",
        `${concept?.code} promoted to finalist`,
        concept?.name,
        "refinement",
      ),
    );
    push({ tone: "success", title: `${concept?.code} promoted to finalist` });
  };

  const startIteration = async (job: GenerationJob) => {
    const finished = await batch.start(job);
    const done = finished.items.filter((i) => i.status === "done").length;
    await update(
      (p) => ({ ...p, stage: "refinement" }),
      timelineEvent("generation", `${done} variations generated`, job.title, "refinement"),
    );
    push({ tone: "success", title: `${done} variations generated` });
  };

  if (shortlisted.length === 0) {
    return (
      <>
        <StageHeader stage="refinement" />
        <EmptyState
          icon={<GitBranch size={26} />}
          title="Nothing shortlisted to refine"
          description="Refinement works on the concepts you shortlisted. Go back to selection and shortlist the ideas worth developing."
          action={
            <Button
              variant="accent"
              onClick={() => router.push(`/projects/${project.id}/selection`)}
            >
              Back to selection
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <StageHeader
        stage="refinement"
        action={
          project.finalistIds.length > 0 ? (
            <Button
              variant="accent"
              size="sm"
              icon={<ArrowRight size={14} />}
              onClick={() => {
                void update((p) => ({ ...p, stage: "finalists" }));
                router.push(`/projects/${project.id}/finalists`);
              }}
            >
              {project.finalistIds.length} finalist
              {project.finalistIds.length === 1 ? "" : "s"}
            </Button>
          ) : undefined
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
          did={
            iterations.length > 0
              ? `${iterations.length} variation${iterations.length === 1 ? "" : "s"} generated so far from your feedback.`
              : "Refinement turns your feedback into controlled variations of a concept you already like."
          }
          why="Every variation keeps a link to its parent, so the design space narrows deliberately rather than drifting. Your feedback also becomes durable design memory."
          next={
            project.finalistIds.length === 0
              ? "Give feedback on a shortlisted concept to generate variations, and promote the strongest to finalist when you are ready."
              : `${project.finalistIds.length} promoted to finalist. Keep refining, or move on to build out their lockups.`
          }
        />

        <Panel className="!p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Badge tone="violet">{shortlisted.length} shortlisted</Badge>
            <Badge tone="neutral">{iterations.length} variations</Badge>
            <Badge tone="success">{project.finalistIds.length} finalists</Badge>
            <span className="ml-auto">
              <Tabs
                value={view}
                onChange={setView}
                options={[
                  { value: "shortlist", label: "Shortlist" },
                  { value: "all", label: "All concepts" },
                  { value: "tree", label: "Version tree" },
                ]}
              />
            </span>
          </div>
        </Panel>

        {view === "shortlist" ? (
          <div className="space-y-4">
            {shortlisted.map((concept) => {
              const children = project.concepts.filter(
                (c) => c.parentConceptId === concept.id,
              );
              const isFinalist = concept.status === "finalist" || concept.status === "approved";

              return (
                <Panel key={concept.id} className={isFinalist ? "border-success/30" : undefined}>
                  <div className="flex flex-wrap gap-5">
                    <button
                      type="button"
                      onClick={() => setDetailId(concept.id)}
                      className="shrink-0"
                    >
                      <ConceptImage
                        assetId={concept.primaryAssetId}
                        alt={concept.name}
                        className="h-32 w-32"
                        imgClassName="p-2"
                      />
                    </button>

                    <div className="min-w-[240px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-faint">{concept.code}</span>
                        <h3 className="text-[15px] text-ink">{concept.name}</h3>
                        {isFinalist ? <Badge tone="success">Finalist</Badge> : null}
                        {concept.rating > 0 ? (
                          <Badge tone="accent">{concept.rating}/5</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-muted">
                        {concept.objective}
                      </p>

                      {concept.critique ? (
                        <p className="mt-2 text-[11px] leading-relaxed text-faint">
                          {concept.critique.concerns[0] ?? concept.critique.summary}
                        </p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="accent"
                          icon={<GitBranch size={13} />}
                          onClick={() => setIterateId(concept.id)}
                        >
                          Refine with feedback
                        </Button>
                        {!isFinalist ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<Trophy size={13} />}
                            onClick={() => promote(concept.id)}
                          >
                            Promote to finalist
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              update((p) => setConceptStatus(p, concept.id, "shortlisted"), null)
                            }
                          >
                            Remove from finalists
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetailId(concept.id)}
                        >
                          Open
                        </Button>
                      </div>
                    </div>
                  </div>

                  {children.length > 0 ? (
                    <div className="mt-5 border-t border-line pt-4">
                      <p className="label-xs mb-3">
                        {children.length} variation{children.length === 1 ? "" : "s"} from this
                        concept
                      </p>
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
                        {children.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => setDetailId(child.id)}
                            className="group rounded-lg border border-line p-1.5 transition-colors hover:border-line-strong"
                          >
                            <ConceptImage
                              assetId={child.primaryAssetId}
                              alt={child.name}
                              imgClassName="p-1.5"
                            />
                            <span className="mt-1.5 flex items-center justify-between px-1">
                              <span className="font-mono text-[10px] text-faint">
                                {child.code}
                              </span>
                              {child.status !== "new" ? (
                                <span
                                  className={
                                    child.status === "rejected"
                                      ? "text-[9px] uppercase text-danger"
                                      : "text-[9px] uppercase text-accent"
                                  }
                                >
                                  {child.status.slice(0, 4)}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        ) : view === "all" ? (
          <ConceptLibrary concepts={project.concepts} onIterate={setIterateId} />
        ) : (
          <Panel>
            <VersionTree
              concepts={project.concepts}
              directions={project.directions}
              onOpen={setDetailId}
            />
          </Panel>
        )}

        {project.finalistIds.length > 0 ? (
          <Panel className="flex flex-wrap items-center justify-between gap-4 border-accent/20">
            <div className="min-w-0">
              <h3 className="text-[14px] text-ink">
                {project.finalistIds.length} finalist
                {project.finalistIds.length === 1 ? "" : "s"} selected
              </h3>
              <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted">
                Two to four finalists is the right number to present. The next stage builds
                each one out into a full lockup family without redesigning the mark.
              </p>
            </div>
            <Button
              variant="accent"
              icon={<ArrowRight size={14} />}
              onClick={() => {
                void update((p) => ({ ...p, stage: "finalists" }));
                router.push(`/projects/${project.id}/finalists`);
              }}
            >
              Build out finalists
            </Button>
          </Panel>
        ) : null}
      </div>

      {iterateId ? (
        <IterateModal
          conceptId={iterateId}
          onClose={() => setIterateId(null)}
          onStart={startIteration}
        />
      ) : null}

      {detailId ? (
        <ConceptDetail
          conceptId={detailId}
          onClose={() => setDetailId(null)}
          onIterate={(id) => {
            setDetailId(null);
            setIterateId(id);
          }}
          onNavigate={setDetailId}
        />
      ) : null}
    </>
  );
}
