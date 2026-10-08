"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { projectRepository } from "@/services/db/repository";
import { api, StorageError } from "@/services/db/api";
import { setActiveProject } from "@/services/gemini/client";
import type { Project, StageId, TimelineEvent } from "@/types";
import { computeStageStates } from "@/workflows/stages";
import { timelineEvent } from "@/workflows/projectFactory";
import type { TimelineKind } from "@/types";

interface ProjectContextValue {
  project: Project | null;
  loading: boolean;
  error: string | null;
  /** Apply a pure mutation and persist it. */
  update: (
    mutator: (project: Project) => Project,
    event?: TimelineEvent | null,
  ) => Promise<Project | null>;
  /** Append a timeline entry without otherwise changing the project. */
  log: (kind: TimelineKind, title: string, detail?: string, stage?: StageId) => Promise<void>;
  reload: () => Promise<void>;
  /** True while a save is in flight — drives the "Saved" indicator. */
  saving: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Writes are serialised through a promise chain so rapid mutations (a batch
   * finishing while the designer is also clicking) can never interleave and
   * clobber each other on the server.
   */
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef<Project | null>(null);

  const apply = useCallback((loaded: Project | undefined) => {
    if (!loaded) {
      setError("This project no longer exists.");
      setProject(null);
    } else {
      // Stage gating is always recomputed from data on load.
      const hydrated = { ...loaded, stageStates: computeStageStates(loaded) };
      latest.current = hydrated;
      setProject(hydrated);
    }
    setLoading(false);
  }, []);

  /* Tag this tab's Gemini calls with the open project for the generation log. */
  useEffect(() => {
    setActiveProject(projectId);
    return () => setActiveProject(null);
  }, [projectId]);

  /* Initial load. Every state write happens after the await, so opening a
     project costs one render rather than a cascade. */
  useEffect(() => {
    let active = true;
    void projectRepository
      .get(projectId)
      .then((loaded) => {
        if (active) apply(loaded);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not open this project.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, apply]);

  /** Explicit re-read, used after an external change. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      apply(await projectRepository.get(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this project.");
      setLoading(false);
    }
  }, [projectId, apply]);

  const update = useCallback(
    async (mutator: (project: Project) => Project, event?: TimelineEvent | null) => {
      const base = latest.current;
      if (!base) return null;

      let next = mutator(base);
      if (event) next = { ...next, timeline: [...next.timeline, event] };
      next = { ...next, stageStates: computeStageStates(next) };

      latest.current = next;
      setProject(next);
      setSaving(true);

      writeQueue.current = writeQueue.current
        .then(() => saveWithRetry(next))
        .then((saved) => {
          // Keep the persisted updatedAt without stomping newer in-memory edits.
          if (latest.current?.id === saved.id) {
            latest.current = { ...latest.current, updatedAt: saved.updatedAt };
          }
        })
        .catch((err) => {
          console.error("[sigil] save failed", err);
          setError(
            err instanceof StorageError && err.status === 409
              ? "This project was changed in another tab or by someone else, so your last change was not saved. Reload the page to continue from the latest version."
              : "Changes could not be saved to the server. Reload the page; anything saved before this is safe.",
          );
        })
        .finally(() => setSaving(false));

      await writeQueue.current;
      return next;
    },
    [],
  );

  const log = useCallback(
    async (kind: TimelineKind, title: string, detail?: string, stage?: StageId) => {
      await update((p) => p, timelineEvent(kind, title, detail, stage));
    },
    [update],
  );

  const value = useMemo(
    () => ({ project, loading, error, update, log, reload: load, saving }),
    [project, loading, error, update, log, load, saving],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

/**
 * Saves ride out short network or server blips. A conflict is never retried:
 * someone else's newer work must not be overwritten.
 */
async function saveWithRetry(project: Project): Promise<Project> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await projectRepository.save(project);
    } catch (err) {
      const conflict = err instanceof StorageError && err.status === 409;
      // A retried save whose first attempt did land looks like a conflict.
      if (conflict && attempt > 0 && (await alreadySaved(project))) {
        return (await projectRepository.get(project.id)) ?? project;
      }
      if (conflict || attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v,
  );
}

async function alreadySaved(project: Project): Promise<boolean> {
  try {
    const { project: latest } = await api<{ project: Project }>(
      `/api/projects/${encodeURIComponent(project.id)}`,
    );
    // The database stores JSON with its keys reordered, so compare canonically.
    const strip = (p: Project) => canonical({ ...p, updatedAt: undefined });
    return strip(latest) === strip(project);
  } catch {
    return false;
  }
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used inside ProjectProvider");
  return ctx;
}

/** Narrowing helper for stage pages, which always have a loaded project. */
export function useLoadedProject(): ProjectContextValue & { project: Project } {
  const ctx = useProject();
  if (!ctx.project) throw new Error("Project not loaded");
  return ctx as ProjectContextValue & { project: Project };
}
