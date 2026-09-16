"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  History,
  Menu,
  Presentation,
  Settings,
  X,
} from "lucide-react";
import { SigilMark } from "@/components/brand/SigilLogo";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, LoadingBlock, ProgressBar } from "@/components/ui/Primitives";
import { useProject } from "@/hooks/useProject";
import { STAGE_BY_ID, stageProgress } from "@/workflows/stages";
import { StageRail } from "./StageRail";
import { FeedbackMemoryPanel } from "./FeedbackMemoryPanel";
import { cn } from "@/utils/cn";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { project, loading, error, saving } = useProject();
  const [navOpen, setNavOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingBlock label="Opening project" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <SigilMark size={40} />
        <div>
          <h1 className="text-xl text-ink">Project unavailable</h1>
          <p className="mt-2 max-w-md text-[13px] text-muted">
            {error ?? "This project could not be opened."}
          </p>
        </div>
        <Link href="/">
          <Button variant="secondary" icon={<ArrowLeft size={14} />}>
            Back to projects
          </Button>
        </Link>
      </div>
    );
  }

  const stage = STAGE_BY_ID[project.stage];
  const progress = stageProgress(project);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-void/85 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <IconButton
            label="Toggle workflow navigation"
            className="lg:hidden"
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? <X size={16} /> : <Menu size={16} />}
          </IconButton>

          <Link href="/" className="flex items-center gap-2.5" aria-label="All projects">
            <SigilMark size={26} />
            <ArrowLeft size={13} className="hidden text-faint sm:block" />
          </Link>

          <div className="mx-1 hidden h-5 w-px bg-line sm:block" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-[15px] text-ink">{project.companyName}</h1>
              {project.isDemo ? <Badge tone="violet">Sample</Badge> : null}
              {project.status === "finalized" ? <Badge tone="success">Finalized</Badge> : null}
            </div>
            <p className="truncate text-[11px] text-faint">
              {stage.label} · step {stage.index + 1} of 10
            </p>
          </div>

          <span
            className={cn(
              "hidden items-center gap-1.5 text-[11px] transition-opacity sm:flex",
              saving ? "text-faint opacity-100" : "text-faint opacity-60",
            )}
          >
            {saving ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                Saving
              </>
            ) : (
              <>
                <Check size={12} />
                Saved locally
              </>
            )}
          </span>

          <Link href={`/projects/${project.id}/history`}>
            <IconButton label="Project history">
              <History size={15} />
            </IconButton>
          </Link>
          <Link href={`/present/${project.id}`} target="_blank">
            <IconButton label="Open client presentation">
              <Presentation size={15} />
            </IconButton>
          </Link>
          <Link href="/settings">
            <IconButton label="Settings">
              <Settings size={15} />
            </IconButton>
          </Link>
        </div>
        <ProgressBar value={progress} className="h-0.5 rounded-none" />
      </header>

      <div className="flex">
        {/* Workflow rail */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[248px] shrink-0 overflow-y-auto border-r border-line bg-surface px-3 pb-8 pt-20 lg:sticky lg:top-14 lg:z-0 lg:h-[calc(100vh-3.5rem)] lg:pt-5",
            navOpen ? "block" : "hidden lg:block",
          )}
        >
          <StageRail project={project} />
          <div className="mt-6 border-t border-line pt-5">
            <FeedbackMemoryPanel />
          </div>
        </aside>

        {navOpen ? (
          <div
            className="fixed inset-0 z-30 bg-void/70 backdrop-blur-sm lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-hidden
          />
        ) : null}

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1180px] px-5 py-8 lg:px-10 lg:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
