"use client";

import { useState } from "react";
import { AlertTriangle, Download, ImageOff, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { ConceptImage } from "@/components/ConceptImage";
import { Button } from "@/components/ui/Button";
import { Badge, Modal } from "@/components/ui/Primitives";
import { useBatchJob } from "@/hooks/useBatchJob";
import { useLoadedProject } from "@/hooks/useProject";
import { useToast } from "@/hooks/useToast";
import { MOCKUP_SURFACES, type MockupSurfaceMeta } from "@/prompts/mockups";
import { assetUrl } from "@/services/db/assetStore";
import type { ConceptMockup, GenerationJob, JobItem, LogoConcept, MockupSurface } from "@/types";
import { createMockupJob } from "@/workflows/generation";
import { downloadBlob } from "@/utils/download";
import { cn } from "@/utils/cn";

type Batch = ReturnType<typeof useBatchJob>;

/** Surfaces that have no mockup yet, or one made from older artwork. */
export function missingSurfaces(concept: LogoConcept): MockupSurface[] {
  return MOCKUP_SURFACES.filter((s) => {
    const mockup = concept.mockups?.find((m) => m.surface === s.id);
    return !mockup || isStale(concept, mockup);
  }).map((s) => s.id);
}

function isStale(concept: LogoConcept, mockup: ConceptMockup): boolean {
  return Boolean(mockup.derivedFrom && mockup.derivedFrom !== concept.primaryAssetId);
}

/** The live job item for this concept and surface, if the batch has one. */
function itemFor(job: GenerationJob | null, conceptId: string, surface: MockupSurface) {
  if (!job || job.kind !== "mockups") return undefined;
  return job.items.find(
    (i) => i.payload.conceptId === conceptId && i.payload.mockupSurface === surface,
  );
}

/**
 * One logo, photographed on paper, cards, ceramic, glass and walls — a board
 * per concept so marks can be compared the way they will actually be seen.
 *
 * `compact` drops the hero tile for the concept detail panel, which already
 * shows the artwork.
 */
export function MockupBoard({
  concept,
  batch,
  compact = false,
}: {
  concept: LogoConcept;
  batch: Batch;
  compact?: boolean;
}) {
  const { project } = useLoadedProject();
  const { push } = useToast();
  const [open, setOpen] = useState<MockupSurface | null>(null);

  const done = MOCKUP_SURFACES.filter((s) =>
    concept.mockups?.some((m) => m.surface === s.id),
  ).length;
  const missing = missingSurfaces(concept);
  const busy = batch.running;

  const generate = async (surfaces: MockupSurface[]) => {
    if (busy || surfaces.length === 0) return;
    const job = await batch.start(createMockupJob(project, [{ concept, surfaces }]));
    const failed = job.items.filter((i) => i.status === "failed").length;
    if (failed > 0) {
      push({
        tone: "error",
        title: `${failed} mockup${failed === 1 ? "" : "s"} failed`,
        body: "Use the retry button on the tile.",
      });
    }
  };

  const openMockup = open ? concept.mockups?.find((m) => m.surface === open) : undefined;
  const openMeta = open ? MOCKUP_SURFACES.find((s) => s.id === open) : undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {compact ? null : (
            <h3 className="truncate text-[14px] text-ink">
              {concept.code} · {concept.name}
            </h3>
          )}
          <p className="text-[11px] text-faint">
            {done} of {MOCKUP_SURFACES.length} surfaces
          </p>
        </div>
        <Button
          size="sm"
          variant={done === 0 ? "accent" : "secondary"}
          icon={<Sparkles size={13} />}
          disabled={busy || !concept.primaryAssetId}
          onClick={() =>
            generate(missing.length > 0 ? missing : MOCKUP_SURFACES.map((s) => s.id))
          }
        >
          {done === 0
            ? "Generate mockups"
            : missing.length > 0
              ? `Generate ${missing.length} missing`
              : "Regenerate all"}
        </Button>
      </div>

      <div
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4",
        )}
      >
        {compact ? null : (
          // Absolutely filled so the tiles, not the artwork, set the row height.
          <div className="relative col-span-2 row-span-2 aspect-[4/3] overflow-hidden rounded-lg bg-white lg:aspect-auto">
            <ConceptImage
              assetId={concept.primaryAssetId}
              alt={concept.name}
              bare
              className="absolute inset-0 aspect-auto h-full w-full"
              imgClassName="p-8"
            />
          </div>
        )}
        {MOCKUP_SURFACES.map((surface) => (
          <MockupTile
            key={surface.id}
            concept={concept}
            surface={surface}
            item={itemFor(batch.job, concept.id, surface.id)}
            busy={busy}
            onOpen={() => setOpen(surface.id)}
            onGenerate={() => generate([surface.id])}
          />
        ))}
      </div>

      {openMockup && openMeta ? (
        <Modal
          open
          size="xl"
          onClose={() => setOpen(null)}
          title={`${concept.code} — ${openMeta.label}`}
          description={concept.name}
          footer={
            <>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw size={13} />}
                disabled={busy}
                onClick={() => {
                  setOpen(null);
                  void generate([openMeta.id]);
                }}
              >
                Regenerate
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Download size={13} />}
                onClick={() => downloadMockup(project.companyName, concept, openMockup)}
              >
                Download
              </Button>
            </>
          }
        >
          <img
            src={assetUrl(openMockup.assetId)}
            alt={`${concept.name} on ${openMeta.label.toLowerCase()}`}
            className="w-full rounded-lg"
          />
        </Modal>
      ) : null}
    </div>
  );
}

function MockupTile({
  concept,
  surface,
  item,
  busy,
  onOpen,
  onGenerate,
}: {
  concept: LogoConcept;
  surface: MockupSurfaceMeta;
  item?: JobItem;
  busy: boolean;
  onOpen: () => void;
  onGenerate: () => void;
}) {
  const mockup = concept.mockups?.find((m) => m.surface === surface.id);
  const working = item?.status === "running" || (busy && item?.status === "pending");
  const failed = item?.status === "failed";

  const label = (
    <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
      {surface.label}
    </span>
  );

  if (working) {
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-2">
        {mockup ? (
          <img src={assetUrl(mockup.assetId)} alt="" className="h-full w-full object-cover opacity-30" />
        ) : (
          <div className="skeleton h-full w-full" />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin text-muted" />
        </span>
        {label}
      </div>
    );
  }

  if (mockup) {
    return (
      <div className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-2">
        <button type="button" onClick={onOpen} className="block h-full w-full">
          <img
            src={assetUrl(mockup.assetId)}
            alt={`${concept.name} on ${surface.label.toLowerCase()}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </button>
        {label}
        {isStale(concept, mockup) ? (
          <Badge tone="caution" className="absolute left-1.5 top-1.5">
            Older artwork
          </Badge>
        ) : null}
        {failed ? (
          <span
            title={item?.error}
            className="absolute right-1.5 top-1.5 rounded bg-danger/80 p-1 text-white"
          >
            <AlertTriangle size={11} />
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-2 px-3 text-center">
      {failed ? (
        <>
          <AlertTriangle size={15} className="text-danger" />
          <p className="line-clamp-2 text-[10px] leading-snug text-muted" title={item?.error}>
            {item?.error ?? "Generation failed"}
          </p>
          <Button size="sm" variant="ghost" icon={<RotateCcw size={12} />} disabled={busy} onClick={onGenerate}>
            Retry
          </Button>
        </>
      ) : (
        <>
          <ImageOff size={15} className="text-faint" />
          <Button size="sm" variant="ghost" disabled={busy || !concept.primaryAssetId} onClick={onGenerate}>
            Generate
          </Button>
        </>
      )}
      {label}
    </div>
  );
}

async function downloadMockup(companyName: string, concept: LogoConcept, mockup: ConceptMockup) {
  const res = await fetch(assetUrl(mockup.assetId));
  const blob = await res.blob();
  const ext = mockup.mimeType.includes("jpeg") ? "jpg" : (mockup.mimeType.split("/")[1] ?? "png");
  downloadBlob(blob, `${companyName}-${concept.code}-${mockup.surface}.${ext}`);
}
