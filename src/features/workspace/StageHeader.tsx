"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Primitives";
import { useProject } from "@/hooks/useProject";
import { STAGES, STAGE_BY_ID } from "@/workflows/stages";
import type { StageId } from "@/types";

/**
 * Every stage opens the same way: what this stage is for, what the designer
 * decides here, and how to move in either direction without losing anything.
 */
export function StageHeader({
  stage,
  action,
}: {
  stage: StageId;
  action?: React.ReactNode;
}) {
  const { project } = useProject();
  if (!project) return null;

  const meta = STAGE_BY_ID[stage];
  const state = project.stageStates[stage];
  const previous = STAGES[meta.index - 1];
  const next = STAGES[meta.index + 1];
  const nextUnlocked = next ? project.stageStates[next.id] !== "locked" : false;

  return (
    <header className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="label-xs">Stage {meta.index + 1} of 10</span>
        {state === "complete" ? (
          <Badge tone="success">Complete</Badge>
        ) : state === "awaiting_review" ? (
          <Badge tone="accent">Needs your decision</Badge>
        ) : state === "in_progress" ? (
          <Badge tone="violet">In progress</Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-[30px] leading-tight text-ink">{meta.label}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{meta.purpose}</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
            <span className="text-muted">Your call here:</span> {meta.decision}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
        {previous ? (
          <Link href={`/projects/${project.id}/${previous.id}`}>
            <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />}>
              {previous.shortLabel}
            </Button>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          nextUnlocked ? (
            <Link href={`/projects/${project.id}/${next.id}`}>
              <Button variant="ghost" size="sm" className="flex-row-reverse">
                <ArrowRight size={13} />
                {next.shortLabel}
              </Button>
            </Link>
          ) : (
            <span className="text-[11px] text-faint">
              {next.shortLabel} unlocks once this stage is complete
            </span>
          )
        ) : (
          <span />
        )}
      </div>
    </header>
  );
}
