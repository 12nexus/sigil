"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Download,
  FileJson,
  FileText,
  History,
  Images,
  Package,
  Sparkles,
} from "lucide-react";
import { AiNote } from "@/components/AiNote";
import { ConceptImage } from "@/components/ConceptImage";
import { Button } from "@/components/ui/Button";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Panel,
} from "@/components/ui/Primitives";
import { StageHeader } from "@/features/workspace/StageHeader";
import { useLoadedProject } from "@/hooks/useProject";
import { resolveGenerationSettings, useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/useToast";
import { generateBrandKit } from "@/services/gemini";
import { GeminiError } from "@/services/gemini/errors";
import type { GeminiErrorCode } from "@/types";
import { timelineEvent } from "@/workflows/projectFactory";
import {
  exportAllConcepts,
  exportBrief,
  exportFinalAssets,
  exportHistory,
  exportProjectData,
} from "./exports";

export function DeliveryStage() {
  const router = useRouter();
  const { project, update } = useLoadedProject();
  const { settings } = useSettings();
  const { push } = useToast();
  const generationSettings = resolveGenerationSettings(settings, project);

  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code: GeminiErrorCode } | null>(null);

  const approvedConcept = useMemo(() => {
    const id = project.approvals.final.conceptId ?? project.approvals.client.conceptId;
    return project.concepts.find((c) => c.id === id);
  }, [project.approvals, project.concepts]);

  const kit = project.brandKit;

  const buildKit = async () => {
    if (!approvedConcept || !project.finalization) return;
    setGenerating(true);
    setError(null);
    try {
      const brandKit = await generateBrandKit(
        project,
        approvedConcept,
        project.finalization,
        generationSettings,
      );
      await update(
        (p) => ({ ...p, brandKit }),
        timelineEvent("ai", "Brand kit generated", undefined, "delivery"),
      );
      push({ tone: "success", title: "Brand kit ready" });
    } catch (err) {
      const geminiError = GeminiError.from(err);
      setError({ message: geminiError.message, code: geminiError.code });
    } finally {
      setGenerating(false);
    }
  };

  const runExport = async (key: string, task: () => void | Promise<void>) => {
    setExporting(key);
    try {
      await task();
      push({ tone: "success", title: "Export ready" });
    } catch (err) {
      push({
        tone: "error",
        title: "Export failed",
        body: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setExporting(null);
    }
  };

  if (!approvedConcept || !project.approvals.final.approved) {
    return (
      <>
        <StageHeader stage="delivery" />
        <EmptyState
          icon={<Package size={26} />}
          title="Not finalized yet"
          description="Delivery opens once the final approval is recorded and the logo system has been built."
          action={
            <Button
              variant="accent"
              onClick={() => router.push(`/projects/${project.id}/finalization`)}
            >
              Go to finalization
            </Button>
          }
        />
      </>
    );
  }

  const assets = approvedConcept.assets;

  return (
    <>
      <StageHeader
        stage="delivery"
        action={
          <Button
            variant="accent"
            size="sm"
            icon={<Download size={14} />}
            loading={exporting === "final"}
            onClick={() => runExport("final", () => exportFinalAssets(project))}
          >
            Download logo package
          </Button>
        }
      />

      <div className="space-y-6">
        {error ? (
          <ErrorNotice
            title="Could not build the brand kit"
            message={error.message}
            code={error.code}
            onRetry={buildKit}
            onDismiss={() => setError(null)}
          />
        ) : null}

        {/* Final logo system */}
        <Panel>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="success">Final identity</Badge>
              <h2 className="mt-2 text-[22px] text-ink">{approvedConcept.name}</h2>
              <p className="mt-1 text-[12px] text-muted">
                {project.companyName} · {assets.length} asset
                {assets.length === 1 ? "" : "s"} in the system
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
            {assets.map((asset) => (
              <div key={asset.assetId}>
                <ConceptImage
                  assetId={asset.assetId}
                  alt={`${approvedConcept.name} ${asset.kind}`}
                  dark={asset.kind === "reversed"}
                  imgClassName="p-3"
                />
                <p className="mt-2 text-center text-[10px] uppercase tracking-[0.1em] text-muted">
                  {asset.kind}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        {/* Brand kit */}
        {!kit ? (
          <Panel className="border-accent/20">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-[14px] text-ink">Brand kit</h3>
                <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted">
                  Palette, typography, clear space, minimum sizes, and the do/don&apos;t rules
                  that keep the mark intact once other people start applying it.
                </p>
              </div>
              <Button
                variant="accent"
                icon={<Sparkles size={14} />}
                loading={generating}
                onClick={buildKit}
              >
                Generate brand kit
              </Button>
            </div>
          </Panel>
        ) : (
          <>
            <AiNote
              tone="accent"
              did="The brand kit is written and ready to hand over."
              why="Colour values, typography, spacing and usage rules in it are production-ready. The logo image files are not — that distinction is stated in the kit and in the ZIP's README."
              next="Open the kit to read or print it, and download the logo package for the client."
            />

            <Panel>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[14px] text-ink">Brand kit</h3>
                <div className="flex gap-2">
                  <a href={`/brandkit/${project.id}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="secondary" icon={<BookOpen size={13} />}>
                      Open / print
                    </Button>
                  </a>
                  <Button size="sm" variant="ghost" loading={generating} onClick={buildKit}>
                    Regenerate
                  </Button>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="label-xs mb-2.5">Palette</p>
                  <div className="flex flex-wrap gap-3">
                    {kit.palette.map((swatch) => (
                      <div key={swatch.hex} className="w-32">
                        <div
                          className="h-16 w-full rounded-lg border border-line"
                          style={{ backgroundColor: swatch.hex }}
                        />
                        <p className="mt-1.5 truncate text-[11px] text-ink">{swatch.name}</p>
                        <p className="font-mono text-[10px] uppercase text-faint">
                          {swatch.hex}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="label-xs mb-1.5">Primary typeface</p>
                    <p className="text-[13px] text-ink">{kit.typography.primary.family}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">
                      {kit.typography.primary.why}
                    </p>
                  </div>
                  <div>
                    <p className="label-xs mb-1.5">Secondary typeface</p>
                    <p className="text-[13px] text-ink">{kit.typography.secondary.family}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">
                      {kit.typography.secondary.why}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="label-xs mb-1.5">Clear space</p>
                    <p className="text-[12px] leading-relaxed text-muted">{kit.clearSpace}</p>
                  </div>
                  <div>
                    <p className="label-xs mb-1.5">Minimum size</p>
                    <p className="text-[12px] leading-relaxed text-muted">{kit.minimumSize}</p>
                  </div>
                </div>
              </div>
            </Panel>
          </>
        )}

        {/* Exports */}
        <Panel>
          <h3 className="mb-1 text-[14px] text-ink">Exports</h3>
          <p className="mb-5 text-[12px] leading-relaxed text-muted">
            Asset bundles include a README stating exactly what the files are, so the
            raster-versus-vector distinction survives being forwarded on.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <ExportRow
              icon={<Package size={15} />}
              title="Final logo package"
              description="Every asset in the approved system, plus the brief, brand kit, and disclosure."
              loading={exporting === "final"}
              onClick={() => runExport("final", () => exportFinalAssets(project))}
            />
            <ExportRow
              icon={<Images size={15} />}
              title="All concepts"
              description={`Every one of the ${project.concepts.length} generated concepts, organised by creative direction.`}
              loading={exporting === "all"}
              onClick={() => runExport("all", () => exportAllConcepts(project))}
            />
            <ExportRow
              icon={<BookOpen size={15} />}
              title="Client presentation"
              description="The polished presentation, ready to print or save as PDF."
              onClick={() => window.open(`/present/${project.id}`, "_blank")}
            />
            <ExportRow
              icon={<FileText size={15} />}
              title="Brand brief"
              description="The approved strategic brief as Markdown."
              loading={exporting === "brief"}
              onClick={() => runExport("brief", () => exportBrief(project))}
            />
            <ExportRow
              icon={<History size={15} />}
              title="Project history"
              description="The full decision timeline from discovery to final approval."
              loading={exporting === "history"}
              onClick={() => runExport("history", () => exportHistory(project))}
            />
            <ExportRow
              icon={<FileJson size={15} />}
              title="Project data"
              description="Complete structured project record as JSON, for archiving or migration."
              loading={exporting === "json"}
              onClick={() => runExport("json", () => exportProjectData(project))}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}

function ExportRow({
  icon,
  title,
  description,
  onClick,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-3.5 text-left transition-colors hover:border-line-strong disabled:opacity-50"
    >
      <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13px] text-ink">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
          {description}
        </span>
      </span>
      <Download size={13} className="ml-auto mt-1 shrink-0 text-faint" />
    </button>
  );
}
