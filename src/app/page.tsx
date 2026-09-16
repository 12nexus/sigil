"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderOpen, KeyRound, LogOut, Plus, Settings, Sparkles } from "lucide-react";
import { SigilLockup } from "@/components/brand/SigilLogo";
import { Button } from "@/components/ui/Button";
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  LoadingBlock,
  Tabs,
} from "@/components/ui/Primitives";
import { NewProjectModal } from "@/features/dashboard/NewProjectModal";
import { ProjectCard } from "@/features/dashboard/ProjectCard";
import { useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/useToast";
import { projectRepository } from "@/services/db/repository";
import { buildDemoProject } from "@/data/demoProject";
import type { ProjectSummary } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const { push } = useToast();
  const { keyConfigured, hasServerKey, loaded } = useSettings();

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setProjects(await projectRepository.list(true));
    } catch (err) {
      console.error(err);
      push({
        tone: "error",
        title: "Could not read local storage",
        body: "SIGIL stores projects in your browser. Private browsing can block this.",
      });
      setProjects([]);
    }
  }, [push]);

  useEffect(() => {
    let active = true;
    void projectRepository
      .list(true)
      .then((rows) => {
        if (active) setProjects(rows);
      })
      .catch(() => {
        if (active) setProjects([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(
    () =>
      (projects ?? []).filter((p) =>
        tab === "archived" ? p.status === "archived" : p.status !== "archived",
      ),
    [projects, tab],
  );

  const archivedCount = (projects ?? []).filter((p) => p.status === "archived").length;
  const activeCount = (projects ?? []).filter((p) => p.status !== "archived").length;

  const loadDemo = async () => {
    setBusy(true);
    try {
      const demo = buildDemoProject();
      await projectRepository.create(demo);
      await refresh();
      push({
        tone: "success",
        title: "Sample project added",
        body: "Nexora is seeded through to approved creative directions.",
      });
      router.push(`/projects/${demo.id}/exploration`);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (id: string) => {
    setBusy(true);
    try {
      const copy = await projectRepository.duplicate(id);
      await refresh();
      if (copy) push({ tone: "success", title: `Duplicated as "${copy.companyName}"` });
    } catch {
      push({ tone: "error", title: "Could not duplicate the project" });
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string, archived: boolean) => {
    await projectRepository.archive(id, archived);
    await refresh();
    push({ tone: "info", title: archived ? "Project archived" : "Project restored" });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await projectRepository.remove(deleteTarget);
      await refresh();
      push({ tone: "info", title: "Project deleted" });
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-void/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6">
          <Link href="/" aria-label="SIGIL home">
            <SigilLockup showTagline />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button variant="ghost" size="sm" icon={<Settings size={14} />}>
                Settings
              </Button>
            </Link>
            <Button variant="ghost" size="sm" icon={<LogOut size={14} />} onClick={signOut}>
              Sign out
            </Button>
            <Button
              variant="accent"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setCreating(true)}
            >
              New project
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-10">
        {/* Key warning — the one thing that stops the product working. */}
        {loaded && !keyConfigured ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-caution/30 bg-caution/8 px-5 py-4">
            <div className="flex items-start gap-3">
              <KeyRound size={16} className="mt-0.5 shrink-0 text-caution" />
              <div>
                <p className="text-[13px] font-medium text-ink">No Gemini API key configured</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  {hasServerKey === false
                    ? "Add GEMINI_API_KEY to .env.local and restart, or paste a key in Settings. Everything else works without one, but nothing can be generated."
                    : "Checking for a server-side key…"}
                </p>
              </div>
            </div>
            <Link href="/settings">
              <Button size="sm" variant="secondary">
                Open settings
              </Button>
            </Link>
          </div>
        ) : null}

        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-[34px] leading-tight text-ink">Projects</h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
              Each project is one client engagement, carrying its own brief, every
              creative direction, and the complete design history behind the final mark.
            </p>
          </div>
          {projects && projects.length > 0 ? (
            <Tabs
              value={tab}
              onChange={setTab}
              options={[
                { value: "active", label: "Active", count: activeCount },
                { value: "archived", label: "Archived", count: archivedCount },
              ]}
            />
          ) : null}
        </div>

        {projects === null ? (
          <LoadingBlock label="Opening your studio" />
        ) : visible.length === 0 ? (
          tab === "archived" ? (
            <EmptyState
              icon={<FolderOpen size={26} />}
              title="Nothing archived"
              description="Archived projects stay fully intact — nothing is deleted when you archive."
            />
          ) : (
            <EmptyState
              icon={<Sparkles size={26} />}
              title="Start your first engagement"
              description="Create a project to begin the discovery interview, or open the Nexora sample — it comes seeded through to approved creative directions so you can see the generation pipeline run for real."
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    variant="accent"
                    icon={<Plus size={14} />}
                    onClick={() => setCreating(true)}
                  >
                    New project
                  </Button>
                  <Button variant="secondary" onClick={loadDemo} loading={busy}>
                    Open the Nexora sample
                  </Button>
                </div>
              }
            />
          )
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visible.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDuplicate={duplicate}
                  onArchive={archive}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>

            {tab === "active" && !projects.some((p) => p.isDemo) ? (
              <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-line px-5 py-4">
                <div className="flex items-center gap-3">
                  <Badge tone="violet">Sample</Badge>
                  <p className="text-[12px] text-muted">
                    Want to see the full pipeline without running discovery? Load the Nexora sample project.
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={loadDemo} loading={busy}>
                  Add sample project
                </Button>
              </div>
            ) : null}
          </>
        )}
      </main>

      <NewProjectModal open={creating} onClose={() => setCreating(false)} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Delete this project?"
        confirmLabel="Delete permanently"
        body="This removes the project, every generated concept, and all of its artwork from local storage. It cannot be undone — archive it instead if you only want it out of the way."
      />
    </div>
  );
}
