"use client";

import { Images, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState, Panel } from "@/components/ui/Primitives";
import { useBatchJob } from "@/hooks/useBatchJob";
import { useLoadedProject } from "@/hooks/useProject";
import type { LogoConcept } from "@/types";
import { createMockupJob } from "@/workflows/generation";
import { MockupBoard, missingSurfaces } from "./MockupBoard";

/** A mockup board for each concept, with one action to fill every gap. */
export function MockupBoards({
  concepts,
  batch,
  emptyHint,
}: {
  concepts: LogoConcept[];
  batch: ReturnType<typeof useBatchJob>;
  emptyHint: string;
}) {
  const { project } = useLoadedProject();
  const ready = concepts.filter((c) => c.primaryAssetId && !c.error);
  const outstanding = ready.reduce((n, c) => n + missingSurfaces(c).length, 0);

  if (ready.length === 0) {
    return (
      <EmptyState
        icon={<Images size={22} />}
        title="No concepts to mock up yet"
        description={emptyHint}
      />
    );
  }

  const generateAll = async () => {
    // One job, only the gaps: surfaces already shot are not paid for twice.
    const requests = ready
      .map((concept) => ({ concept, surfaces: missingSurfaces(concept) }))
      .filter((r) => r.surfaces.length > 0);
    if (requests.length === 0) return;
    await batch.start(createMockupJob(project, requests));
  };

  return (
    <div className="space-y-4">
      <Panel className="flex flex-wrap items-center justify-between gap-3 !p-4">
        <p className="max-w-2xl text-[12px] leading-relaxed text-muted">
          Each logo photographed on paper, business cards, a mug, signage, glass and
          stationery, so you can judge it the way people will actually see it. Mockups are
          generated from the concept&apos;s own artwork with the high-fidelity image model.
        </p>
        {outstanding > 0 ? (
          <Button
            size="sm"
            variant="accent"
            icon={<Sparkles size={13} />}
            disabled={batch.running}
            onClick={generateAll}
          >
            Generate {outstanding} mockup{outstanding === 1 ? "" : "s"} for {ready.length}{" "}
            concept{ready.length === 1 ? "" : "s"}
          </Button>
        ) : null}
      </Panel>

      {ready.map((concept) => (
        <Panel key={concept.id}>
          <MockupBoard concept={concept} batch={batch} />
        </Panel>
      ))}
    </div>
  );
}
