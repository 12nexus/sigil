"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Circle, Dot, Lock } from "lucide-react";
import { STAGES, STAGE_STATE_LABEL } from "@/workflows/stages";
import type { Project, StageState } from "@/types";
import { cn } from "@/utils/cn";

/**
 * Persistent workflow navigation.
 *
 * Answers the four questions the designer always needs: where am I, what is
 * done, what is waiting on me, and what comes next. Completed stages stay
 * clickable forever — going back never destroys anything.
 */
export function StageRail({ project }: { project: Project }) {
  const pathname = usePathname();
  const states = project.stageStates;

  return (
    <nav aria-label="Workflow stages" className="flex flex-col gap-0.5">
      <p className="label-xs px-3 pb-2">Workflow</p>
      {STAGES.map((stage, i) => {
        const state = states[stage.id];
        const href = `/projects/${project.id}/${stage.id}`;
        const active = pathname === href;
        const locked = state === "locked";

        return (
          <Link
            key={stage.id}
            href={locked ? "#" : href}
            aria-current={active ? "page" : undefined}
            aria-disabled={locked}
            onClick={(e) => locked && e.preventDefault()}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
              active
                ? "bg-surface-3 text-ink"
                : locked
                  ? "cursor-not-allowed text-faint/60"
                  : "text-muted hover:bg-white/4 hover:text-ink",
            )}
            title={locked ? `Complete ${stage.requires.join(", ")} first` : stage.purpose}
          >
            <StageDot state={state} index={i} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] leading-tight">{stage.label}</span>
              {state === "awaiting_review" ? (
                <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-accent">
                  Needs your decision
                </span>
              ) : null}
            </span>
            {active ? (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function StageDot({ state, index }: { state: StageState; index: number }) {
  const base =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium transition-colors";

  if (state === "complete") {
    return (
      <span
        className={cn(base, "border-success/40 bg-success/15 text-success")}
        title={STAGE_STATE_LABEL[state]}
      >
        <Check size={12} strokeWidth={2.5} />
      </span>
    );
  }
  if (state === "awaiting_review") {
    return (
      <span
        className={cn(base, "border-accent/50 bg-accent/15 text-accent")}
        title={STAGE_STATE_LABEL[state]}
      >
        <Dot size={20} strokeWidth={4} />
      </span>
    );
  }
  if (state === "locked") {
    return (
      <span className={cn(base, "border-line bg-surface-2 text-faint/60")} title="Locked">
        <Lock size={10} />
      </span>
    );
  }
  if (state === "in_progress") {
    return (
      <span
        className={cn(base, "border-violet/40 bg-violet/12 text-violet")}
        title={STAGE_STATE_LABEL[state]}
      >
        <Circle size={8} fill="currentColor" />
      </span>
    );
  }
  return (
    <span className={cn(base, "border-line bg-surface-2 text-faint")} title="Ready">
      {index + 1}
    </span>
  );
}
