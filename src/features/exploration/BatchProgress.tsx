"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Panel, ProgressBar } from "@/components/ui/Primitives";
import type { GenerationJob } from "@/types";
import type { JobProgress } from "@/workflows/batchRunner";
import { cn } from "@/utils/cn";

/**
 * Live batch progress.
 *
 * Shows real per-item state — not a fake progress bar — and keeps failed items
 * individually retryable so a partial failure never means re-running the whole
 * batch and paying for the images that already succeeded.
 */
export function BatchProgress({
  job,
  progress,
  onCancel,
  onPause,
  onResume,
  onRetryItem,
  onRetryFailed,
  onDismiss,
}: {
  job: GenerationJob;
  progress: JobProgress;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetryItem: (itemId: string) => void;
  onRetryFailed: () => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const running = job.status === "running";
  const failed = job.items.filter((i) => i.status === "failed");

  return (
    <Panel className="border-violet/25">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {running ? (
            <Loader2 size={16} className="shrink-0 animate-spin text-violet" />
          ) : job.status === "completed" ? (
            <Check size={16} className="shrink-0 text-success" />
          ) : job.status === "completed_with_errors" ? (
            <AlertTriangle size={16} className="shrink-0 text-caution" />
          ) : (
            <Pause size={16} className="shrink-0 text-muted" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] text-ink">{job.title}</p>
            <p className="text-[11px] text-muted">{progress.label}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {running ? (
            <>
              <Button size="sm" variant="ghost" icon={<Pause size={13} />} onClick={onPause}>
                Pause
              </Button>
              <Button size="sm" variant="ghost" icon={<X size={13} />} onClick={onCancel}>
                Cancel
              </Button>
            </>
          ) : job.status === "paused" || job.status === "cancelled" ? (
            <Button size="sm" variant="secondary" icon={<Play size={13} />} onClick={onResume}>
              Resume
            </Button>
          ) : null}

          {!running && failed.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<RotateCcw size={13} />}
              onClick={onRetryFailed}
            >
              Retry {failed.length} failed
            </Button>
          ) : null}

          {!running && (job.status === "completed" || job.status === "cancelled") ? (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          ) : null}

          <IconButton
            label={expanded ? "Hide items" : "Show items"}
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown size={15} className={cn("transition-transform", expanded && "rotate-180")} />
          </IconButton>
        </div>
      </div>

      <ProgressBar value={progress.ratio} tone="violet" className="mt-4" />

      <div className="mt-3 flex flex-wrap gap-2">
        {progress.done > 0 ? <Badge tone="success">{progress.done} generated</Badge> : null}
        {progress.running > 0 ? <Badge tone="violet">{progress.running} in flight</Badge> : null}
        {progress.pending > 0 ? <Badge tone="neutral">{progress.pending} queued</Badge> : null}
        {progress.failed > 0 ? <Badge tone="danger">{progress.failed} failed</Badge> : null}
        {progress.cancelled > 0 ? (
          <Badge tone="neutral">{progress.cancelled} cancelled</Badge>
        ) : null}
      </div>

      {progress.done > 0 && (progress.failed > 0 || job.status === "cancelled") ? (
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          The {progress.done} concept{progress.done === 1 ? "" : "s"} that completed
          {progress.done === 1 ? " is" : " are"} already saved. Retrying only regenerates
          what failed.
        </p>
      ) : null}

      {expanded ? (
        <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto border-t border-line pt-3">
          {job.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/3"
            >
              <span className="mt-0.5 shrink-0">
                {item.status === "done" ? (
                  <Check size={12} className="text-success" />
                ) : item.status === "running" ? (
                  <Loader2 size={12} className="animate-spin text-violet" />
                ) : item.status === "failed" ? (
                  <AlertTriangle size={12} className="text-danger" />
                ) : item.status === "cancelled" ? (
                  <X size={12} className="text-faint" />
                ) : (
                  <span className="block h-3 w-3 rounded-full border border-line" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-muted">{item.label}</span>
                {item.error ? (
                  <span className="mt-0.5 block text-[11px] leading-snug text-danger/85">
                    {item.error}
                  </span>
                ) : null}
                {item.attempts > 1 && item.status === "done" ? (
                  <span className="text-[10px] text-faint">
                    succeeded on attempt {item.attempts}
                  </span>
                ) : null}
              </span>
              {item.status === "failed" ? (
                <button
                  type="button"
                  onClick={() => onRetryItem(item.id)}
                  className="shrink-0 text-[11px] text-accent underline underline-offset-2 hover:text-accent-bright"
                >
                  Retry
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
