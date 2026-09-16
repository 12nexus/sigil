"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Printer, X } from "lucide-react";
import { ConceptImage } from "@/components/ConceptImage";
import { SigilGlyph } from "@/components/brand/SigilLogo";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Primitives";
import { projectRepository } from "@/services/db/repository";
import type { Project } from "@/types";
import { formatDate } from "@/utils/format";

/**
 * The printable brand kit.
 *
 * Laid out as a real brand document rather than a dump of images, and printed
 * through the browser's own PDF engine so the output is vector text at full
 * resolution instead of a rasterised screenshot.
 */
export function BrandKitDocument({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void projectRepository.get(projectId).then((loaded) => {
      if (!active) return;
      setProject(loaded ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0]">
        <LoadingBlock label="Loading brand kit" />
      </div>
    );
  }

  const kit = project?.brandKit;
  const concept = project?.concepts.find((c) => c.id === kit?.conceptId);

  if (!project || !kit || !concept) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0] px-6 text-center">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[#16161c]">
            No brand kit yet
          </h1>
          <p className="mt-3 max-w-md text-[13px] text-[#6b6862]">
            Generate the brand kit from the Delivery stage first.
          </p>
        </div>
      </div>
    );
  }

  const section = "print-page mx-auto max-w-4xl px-8 py-14";

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#16161c]">
      <div className="no-print sticky top-0 z-30 border-b border-[#ded9d0] bg-[#f7f5f0]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-8">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8c887f]">
            {project.companyName} · Brand kit
          </p>
          <Button
            size="sm"
            variant="ghost"
            icon={<Printer size={13} />}
            onClick={() => window.print()}
            className="!text-[#6b6862] hover:!bg-black/5 hover:!text-[#16161c]"
          >
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Cover */}
      <section className={section}>
        <div className="flex min-h-[60vh] flex-col justify-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#8c887f]">Brand kit</p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-[56px] leading-[1.05]">
            {project.companyName}
          </h1>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[#4a4842]">
            {project.brief?.company.description}
          </p>
          <p className="mt-10 text-[12px] text-[#8c887f]">
            {formatDate(kit.generatedAt)}
          </p>
        </div>
      </section>

      {/* The mark */}
      <section className={section}>
        <SectionTitle>The mark</SectionTitle>
        <div className="mt-8 rounded-2xl border border-[#e4dfd6] bg-white p-12 print-surface">
          <div className="mx-auto flex aspect-[16/8] max-w-2xl items-center justify-center">
            <ConceptImage
              assetId={concept.primaryAssetId}
              alt={concept.name}
              className="h-full w-full !rounded-none"
              padded={false}
              bare
            />
          </div>
        </div>
        <h3 className="mt-8 font-[family-name:var(--font-display)] text-[24px]">
          {concept.name}
        </h3>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[#4a4842]">
          {kit.rationale}
        </p>
      </section>

      {/* Variations */}
      {concept.assets.length > 1 ? (
        <section className={section}>
          <SectionTitle>Logo variations</SectionTitle>
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3">
            {concept.assets.map((asset) => (
              <div key={asset.assetId}>
                <div
                  className={
                    asset.kind === "reversed"
                      ? "flex aspect-square items-center justify-center rounded-xl border border-[#2a2a32] bg-[#16161c]"
                      : "flex aspect-square items-center justify-center rounded-xl border border-[#e4dfd6] bg-white print-surface"
                  }
                >
                  <ConceptImage
                    assetId={asset.assetId}
                    alt={asset.kind}
                    className="h-full w-full !rounded-none"
                    padded={false}
                    imgClassName="p-6"
                    bare
                  />
                </div>
                <p className="mt-2.5 text-[11px] uppercase tracking-[0.12em] text-[#8c887f]">
                  {asset.kind}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Palette */}
      <section className={section}>
        <SectionTitle>Colour palette</SectionTitle>
        <div className="mt-8 space-y-4">
          {kit.palette.map((swatch) => (
            <div
              key={swatch.hex}
              className="flex flex-wrap items-center gap-6 border-b border-[#e8e4db] pb-4"
            >
              <div
                className="h-20 w-32 shrink-0 rounded-lg border border-[#ded9d0]"
                style={{ backgroundColor: swatch.hex }}
              />
              <div className="min-w-[200px] flex-1">
                <p className="text-[15px]">{swatch.name}</p>
                <p className="mt-0.5 font-mono text-[12px] uppercase text-[#8c887f]">
                  {swatch.hex} · {swatch.role}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[#4a4842]">
                  {swatch.usage}
                </p>
                {swatch.contrastNote ? (
                  <p className="mt-1 text-[11px] text-[#8c887f]">{swatch.contrastNote}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className={section}>
        <SectionTitle>Typography</SectionTitle>
        <div className="mt-8 space-y-8">
          {[kit.typography.primary, kit.typography.secondary].map((font, i) => (
            <div key={i} className="border-b border-[#e8e4db] pb-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8c887f]">
                {i === 0 ? "Primary" : "Secondary"}
              </p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-[28px]">
                {font.family}
              </h3>
              <p className="mt-1 text-[12px] text-[#8c887f]">
                {font.category} · {font.weight}
                {font.source ? ` · ${font.source}` : ""}
              </p>
              <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-[#4a4842]">
                {font.why}
              </p>
            </div>
          ))}
          {kit.typography.notes ? (
            <p className="max-w-2xl text-[13px] leading-relaxed text-[#4a4842]">
              {kit.typography.notes}
            </p>
          ) : null}
        </div>
      </section>

      {/* Rules */}
      <section className={section}>
        <SectionTitle>Using the mark</SectionTitle>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-[#8c887f]">
              Clear space
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#4a4842]">{kit.clearSpace}</p>
          </div>
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-[#8c887f]">
              Minimum size
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#4a4842]">{kit.minimumSize}</p>
          </div>
        </div>

        <div className="mt-10">
          <h3 className="text-[11px] uppercase tracking-[0.14em] text-[#8c887f]">
            Usage rules
          </h3>
          <ul className="mt-3 space-y-2">
            {kit.usageRules.map((rule, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-[#4a4842]">
                {rule}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#3f7d53]">
              <Check size={12} />
              Do
            </h3>
            <ul className="mt-3 space-y-2">
              {kit.dos.map((item, i) => (
                <li key={i} className="text-[13px] leading-relaxed text-[#4a4842]">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#a8403a]">
              <X size={12} />
              Don&apos;t
            </h3>
            <ul className="mt-3 space-y-2">
              {kit.donts.map((item, i) => (
                <li key={i} className="text-[13px] leading-relaxed text-[#4a4842]">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Personality + disclosure */}
      <section className={section}>
        <SectionTitle>Brand personality</SectionTitle>
        <p className="mt-6 font-[family-name:var(--font-display)] text-[24px] leading-relaxed">
          {kit.personality.join(" · ")}
        </p>

        <div className="mt-14 rounded-xl border border-[#e0cfa8] bg-[#fbf5e8] p-6 print-surface">
          <h3 className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-[#8a6d2f]">
            <AlertTriangle size={13} />
            Asset disclosure
          </h3>
          <p className="mt-3 text-[12px] leading-relaxed text-[#5c5343]">
            {kit.assetDisclosure}
          </p>
        </div>

        <div className="mt-16 flex items-center justify-center gap-2 text-[11px] text-[#a8a49a]">
          <SigilGlyph size={11} />
          <span className="tracking-[0.2em]">SIGIL</span>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-[#ded9d0] pb-3 text-[11px] uppercase tracking-[0.2em] text-[#8c887f]">
      {children}
    </h2>
  );
}
