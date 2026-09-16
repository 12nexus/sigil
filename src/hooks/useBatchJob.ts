"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { projectRepository } from "@/services/db/repository";
import type { ConceptAsset, GenerationJob, LogoConcept, Project } from "@/types";
import { BatchRunner, jobProgress, type JobProgress } from "@/workflows/batchRunner";
import { makeExecutor } from "@/workflows/generation";
import { resolveGenerationSettings, useSettings } from "./useSettings";
import { useProject } from "./useProject";

/**
 * Wires the batch runner to the project store.
 *
 * Completed items are written into the project the moment they finish, so a
 * failed sibling, a cancelled run, or a browser refresh never costs work that
 * was already generated and paid for.
 */
export function useBatchJob(projectId: string) {
  const { project, update } = useProject();
  const { settings } = useSettings();

  const [job, setJob] = useState<GenerationJob | null>(null);
  const [resumable, setResumable] = useState<GenerationJob[]>([]);
  const runnerRef = useRef<BatchRunner | null>(null);

  /** The runner reads the freshest project through this ref, never a stale closure. */
  const projectRef = useRef<Project | null>(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  /* Look for jobs left unfinished by a previous session. */
  useEffect(() => {
    let active = true;
    void projectRepository.listJobs(projectId).then((jobs) => {
      if (!active) return;
      setResumable(
        jobs.filter(
          (j) =>
            j.status === "running" || j.status === "paused" || j.status === "queued" ||
            (j.status === "completed_with_errors" &&
              j.items.some((i) => i.status === "failed")),
        ),
      );
    });
    return () => {
      active = false;
    };
  }, [projectId, job?.status]);

  const persist = useCallback(async (next: GenerationJob) => {
    await projectRepository.saveJob(next);
  }, []);

  const buildRunner = useCallback(
    (initial: GenerationJob) => {
      const generationSettings = resolveGenerationSettings(settings, projectRef.current);

      const executor = makeExecutor({
        getProject: () => projectRef.current!,
        settings: generationSettings,
        onConcept: async (concept: LogoConcept) => {
          const next = await update((p) => ({ ...p, concepts: [...p.concepts, concept] }), null);
          if (next) projectRef.current = next;
        },
        onLockup: async (conceptId: string, asset: ConceptAsset) => {
          const next = await update(
            (p) => ({
              ...p,
              concepts: p.concepts.map((c) =>
                c.id === conceptId
                  ? {
                      ...c,
                      // Replacing by kind keeps regenerated lockups from stacking up.
                      assets: [...c.assets.filter((a) => a.kind !== asset.kind), asset],
                      updatedAt: new Date().toISOString(),
                    }
                  : c,
              ),
            }),
            null,
          );
          if (next) projectRef.current = next;
        },
      });

      return new BatchRunner(
        initial,
        executor,
        { onProgress: setJob, onPersist: persist },
        {
          concurrency: generationSettings.batchConcurrency,
          maxRetries: generationSettings.maxRetries,
        },
      );
    },
    [settings, update, persist],
  );

  const start = useCallback(
    async (initial: GenerationJob) => {
      await projectRepository.saveJob(initial);
      setJob(initial);
      const runner = buildRunner(initial);
      runnerRef.current = runner;
      return runner.run();
    },
    [buildRunner],
  );

  const resume = useCallback(
    async (existing: GenerationJob) => {
      setJob(existing);
      const runner = buildRunner(existing);
      runnerRef.current = runner;
      return runner.run();
    },
    [buildRunner],
  );

  const cancel = useCallback(() => runnerRef.current?.cancel(), []);
  const pause = useCallback(() => runnerRef.current?.pause(), []);

  const retryItem = useCallback(async (itemId: string) => {
    await runnerRef.current?.retryItem(itemId);
  }, []);

  const retryFailed = useCallback(async () => {
    const current = runnerRef.current?.snapshot ?? job;
    if (!current) return;
    const runner = runnerRef.current ?? buildRunner(current);
    runnerRef.current = runner;
    await runner.run();
  }, [job, buildRunner]);

  const dismiss = useCallback(async () => {
    const current = runnerRef.current?.snapshot ?? job;
    if (current) await projectRepository.removeJob(current.id);
    runnerRef.current = null;
    setJob(null);
    setResumable((prev) => prev.filter((j) => j.id !== current?.id));
  }, [job]);

  const progress: JobProgress | null = job ? jobProgress(job) : null;
  const running = job?.status === "running";

  return {
    job,
    progress,
    running,
    resumable,
    start,
    resume,
    cancel,
    pause,
    retryItem,
    retryFailed,
    dismiss,
  };
}
