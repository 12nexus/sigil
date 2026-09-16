"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Flag,
  MessageSquare,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, Panel, Tabs } from "@/components/ui/Primitives";
import { useLoadedProject } from "@/hooks/useProject";
import { exportHistory } from "@/features/delivery/exports";
import { STAGE_BY_ID } from "@/workflows/stages";
import type { TimelineKind } from "@/types";
import { formatClock, formatDate } from "@/utils/format";

const KIND_ICON: Record<TimelineKind, React.ReactNode> = {
  stage: <Flag size={12} />,
  ai: <Sparkles size={12} />,
  decision: <CheckCircle2 size={12} />,
  generation: <Wand2 size={12} />,
  client: <MessageSquare size={12} />,
  system: <Settings2 size={12} />,
};

const KIND_TONE: Record<TimelineKind, string> = {
  stage: "text-muted",
  ai: "text-violet",
  decision: "text-success",
  generation: "text-accent",
  client: "text-caution",
  system: "text-faint",
};

export default function HistoryPage() {
  const { project } = useLoadedProject();
  const [filter, setFilter] = useState<"all" | "decision" | "ai" | "client">("all");

  const events = useMemo(() => {
    const filtered =
      filter === "all"
        ? project.timeline
        : project.timeline.filter((e) =>
            filter === "ai" ? e.kind === "ai" || e.kind === "generation" : e.kind === filter,
          );
    return [...filtered].sort((a, b) => b.at.localeCompare(a.at));
  }, [project.timeline, filter]);

  /** Group by calendar day so the timeline reads like a studio log. */
  const grouped = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const event of events) {
      const day = new Date(event.at).toDateString();
      map.set(day, [...(map.get(day) ?? []), event]);
    }
    return [...map.entries()];
  }, [events]);

  return (
    <>
      <header className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-xs mb-2">Project record</p>
            <h1 className="text-[30px] leading-tight text-ink">History</h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
              Every decision, generation, and approval, in order. Nothing here is ever
              removed — this is what makes an earlier choice recoverable.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={13} />}
            onClick={() => exportHistory(project)}
          >
            Export
          </Button>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Everything", count: project.timeline.length },
            {
              value: "decision",
              label: "Your decisions",
              count: project.timeline.filter((e) => e.kind === "decision").length,
            },
            {
              value: "ai",
              label: "AI work",
              count: project.timeline.filter((e) => e.kind === "ai" || e.kind === "generation")
                .length,
            },
            {
              value: "client",
              label: "Client",
              count: project.timeline.filter((e) => e.kind === "client").length,
            },
          ]}
        />
        <p className="text-[12px] text-faint">
          {project.concepts.length} concepts · {project.directions.length} directions
        </p>
      </div>

      <div className="space-y-8">
        {grouped.map(([day, dayEvents]) => (
          <section key={day}>
            <h2 className="label-xs mb-4">{formatDate(dayEvents[0].at)}</h2>
            <ol className="relative space-y-0 border-l border-line pl-6">
              {dayEvents.map((event) => (
                <li key={event.id} className="relative pb-6 last:pb-0">
                  <span
                    className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface ${KIND_TONE[event.kind]}`}
                  >
                    {KIND_ICON[event.kind]}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <span className="font-mono text-[11px] text-faint">
                      {formatClock(event.at)}
                    </span>
                    <span className="text-[13px] text-ink">{event.title}</span>
                    {event.stage ? (
                      <Badge tone="neutral">{STAGE_BY_ID[event.stage].shortLabel}</Badge>
                    ) : null}
                  </div>
                  {event.detail ? (
                    <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted">
                      {event.detail}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ))}

        {grouped.length === 0 ? (
          <Panel className="text-center">
            <p className="text-[13px] text-muted">Nothing recorded under this filter yet.</p>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
