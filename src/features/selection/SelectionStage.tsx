"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AiNote } from "@/components/AiNote";
import { Button } from "@/components/ui/Button";
import { Badge, Panel, Tabs } from "@/components/ui/Primitives";
import { ConceptLibrary } from "@/features/concepts/ConceptLibrary";
import { ConceptDetail } from "@/features/concepts/ConceptDetail";
import { IterateModal } from "@/features/concepts/IterateModal";
import { VersionTree } from "@/features/concepts/VersionTree";
import { StageHeader } from "@/features/workspace/StageHeader";
import { useBatchJob } from "@/hooks/useBatchJob";
import { useLoadedProject } from "@/hooks/useProject";
import { useToast } from "@/hooks/useToast";
import { BatchProgress } from "@/features/exploration/BatchProgress";
import type { GenerationJob } from "@/types";

export function SelectionStage() {
  const router = useRouter();
  const { project, update } = useLoadedProject();
  const { push } = useToast();
  const batch = useBatchJob(project.id);

  const [view, setView] = useState<"grid" | "tree">("grid");
  const [iterateId, setIterateId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const shortlisted = useMemo(
    () =>
      project.concepts.filter(
        (c) => c.status === "shortlisted" || c.status === "finalist" || c.status === "approved",
      ),
    [project.concepts],
  );
  const favorites = useMemo(
    () => project.concepts.filter((c) => c.status === "favorite"),
    [project.concepts],
  );
  const rejected = useMemo(
    () => project.concepts.filter((c) => c.status === "rejected"),
    [project.concepts],
  );

  const proceed = async () => {
    await update((p) => ({ ...p, stage: "refinement" }));
    router.push(`/projects/${project.id}/refinement`);
  };

  const startIteration = async (job: GenerationJob) => {
    await batch.start(job);
    push({ tone: "success", title: "Variations generated" });
  };

  return (
    <>
      <StageHeader
        stage="selection"
        action={
          shortlisted.length > 0 ? (
            <Button
              variant="accent"
              size="sm"
              icon={<ArrowRight size={14} />}
              onClick={proceed}
            >
              Refine {shortlisted.length} shortlisted
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
          tone="accent"
          did="This is the curation stage — nothing here is decided by AI."
          why="You are narrowing a broad exploration down to the ideas worth developing. Rejected concepts are kept forever and feed back into the design memory, so the next round avoids what you turned down."
          next={
            shortlisted.length === 0
              ? "Shortlist the concepts worth developing. Select several and compare them side by side if it helps."
              : `${shortlisted.length} shortlisted. Move on to refinement, or keep narrowing.`
          }
        />

        {/* Curation summary */}
        <Panel className="!p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-[12px] text-muted">
              <span className="text-ink">{project.concepts.length}</span> generated
            </span>
            <Badge tone="accent">{favorites.length} favourited</Badge>
            <Badge tone="violet">{shortlisted.length} shortlisted</Badge>
            <Badge tone="danger">{rejected.length} rejected</Badge>
            <span className="ml-auto flex items-center gap-2">
              <Tabs
                value={view}
                onChange={setView}
                options={[
                  { value: "grid", label: "Library" },
                  { value: "tree", label: "Version tree" },
                ]}
              />
            </span>
          </div>
        </Panel>

        {view === "grid" ? (
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

        {shortlisted.length > 0 ? (
          <Panel className="flex flex-wrap items-center justify-between gap-4 border-accent/20">
            <div className="min-w-0">
              <h3 className="text-[14px] text-ink">
                {shortlisted.length} concept{shortlisted.length === 1 ? "" : "s"} shortlisted
              </h3>
              <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted">
                Refinement lets you give feedback on any of these and generate controlled
                variations from it. You can come back here and change the shortlist at any
                time.
              </p>
            </div>
            <Button variant="accent" icon={<ArrowRight size={14} />} onClick={proceed}>
              Go to refinement
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
