"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Printer,
  Send,
} from "lucide-react";
import { ConceptImage } from "@/components/ConceptImage";
import { SigilGlyph } from "@/components/brand/SigilLogo";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Primitives";
import { projectRepository } from "@/services/db/repository";
import type { ClientDecision, LogoConcept, Project } from "@/types";
import { newId } from "@/utils/id";
import { cn } from "@/utils/cn";

/**
 * Client presentation mode.
 *
 * A deliberately different surface: light, quiet, gallery-like. It shows the
 * work and the thinking behind it, and nothing else. Concept codes, ratings,
 * AI critiques, prompts, rejected concepts, model names, and the designer's
 * private notes never reach this component.
 */
export function PresentationView({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

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

  const concepts = useMemo<LogoConcept[]>(() => {
    if (!project) return [];
    const order = project.clientReview.conceptOrder.length
      ? project.clientReview.conceptOrder
      : project.finalistIds;
    return order
      .map((id) => project.concepts.find((c) => c.id === id))
      .filter((c): c is LogoConcept => Boolean(c) && c!.clientVisible);
  }, [project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, concepts.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [concepts.length]);

  const submit = async (conceptId: string | undefined, nextDecision: ClientDecision) => {
    if (!project) return;
    if (nextDecision !== "approved" && !draft.trim()) return;

    setSubmitting(true);
    try {
      const entry = {
        id: newId("fb"),
        conceptId,
        decision: nextDecision,
        body: draft.trim() || "Approved as presented.",
        submittedAt: new Date().toISOString(),
        interpretationStatus: "none" as const,
      };

      const updated: Project = {
        ...project,
        clientReview: {
          ...project.clientReview,
          feedback: [...project.clientReview.feedback, entry],
        },
        timeline: [
          ...project.timeline,
          {
            id: newId("evt"),
            at: entry.submittedAt,
            kind: "client" as const,
            stage: "client-review" as const,
            title:
              nextDecision === "approved"
                ? "Client approved a concept"
                : nextDecision === "changes_requested"
                  ? "Client requested changes"
                  : "Client left a comment",
            detail: entry.body.slice(0, 160),
          },
        ],
      };

      await projectRepository.save(updated);
      setProject(updated);
      setDraft("");
      setSent(
        nextDecision === "approved"
          ? "Thank you — your approval has been sent to the design team."
          : "Thank you — your feedback has been sent to the design team.",
      );
      setTimeout(() => setSent(null), 6000);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0]">
        <LoadingBlock label="Loading presentation" />
      </div>
    );
  }

  if (!project || !project.clientReview.published || concepts.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0] px-6 text-center">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[#16161c]">
            Nothing to show yet
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-[#6b6862]">
            {project && !project.clientReview.published
              ? "This presentation has not been published yet. Your design team will send it when it is ready."
              : "This presentation is not available."}
          </p>
        </div>
      </div>
    );
  }

  const current = concepts[index];

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#16161c]">
      {/* Header */}
      <header className="no-print sticky top-0 z-30 border-b border-[#ded9d0] bg-[#f7f5f0]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <div className="min-w-0">
            <h1 className="truncate font-[family-name:var(--font-display)] text-lg">
              {project.clientReview.presentationTitle}
            </h1>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8c887f]">
              {concepts.length} concept{concepts.length === 1 ? "" : "s"} for your review
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon={<Printer size={13} />}
            onClick={() => window.print()}
            className="!text-[#6b6862] hover:!bg-black/5 hover:!text-[#16161c]"
          >
            Save as PDF
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {project.clientReview.presentationIntro ? (
          <p className="mx-auto mb-12 max-w-2xl text-center font-[family-name:var(--font-display)] text-[19px] leading-relaxed text-[#3c3a35]">
            {project.clientReview.presentationIntro}
          </p>
        ) : null}

        {/* Concept navigation */}
        <nav className="no-print mb-8 flex flex-wrap items-center justify-center gap-2">
          {concepts.map((concept, i) => (
            <button
              key={concept.id}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-[12px] transition-colors",
                i === index
                  ? "border-[#16161c] bg-[#16161c] text-[#f7f5f0]"
                  : "border-[#ded9d0] text-[#6b6862] hover:border-[#b8b2a6]",
              )}
            >
              {concept.name}
            </button>
          ))}
        </nav>

        {/* The work */}
        <article className="print-page">
          <div className="rounded-2xl border border-[#e4dfd6] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_44px_-24px_rgba(0,0,0,0.18)] print-surface sm:p-12">
            <div className="mx-auto flex aspect-[16/9] max-w-3xl items-center justify-center">
              <ConceptImage
                assetId={current.primaryAssetId}
                alt={current.name}
                className="h-full w-full !rounded-none"
                imgClassName="p-4"
                padded={false}
                bare
              />
            </div>

            <div className="mx-auto mt-10 max-w-2xl text-center">
              <h2 className="font-[family-name:var(--font-display)] text-[28px] leading-tight">
                {current.name}
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-[#4a4842]">
                {current.rationale}
              </p>
            </div>

            {/* Lockups, if they have been built */}
            {current.assets.filter((a) => a.kind !== "primary").length > 0 ? (
              <div className="mx-auto mt-12 max-w-4xl border-t border-[#ece8e0] pt-8">
                <p className="mb-5 text-center text-[10px] uppercase tracking-[0.18em] text-[#8c887f]">
                  How it works across applications
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {current.assets
                    .filter((a) => a.kind !== "primary")
                    .slice(0, 8)
                    .map((asset) => (
                      <div key={asset.assetId}>
                        <div
                          className={cn(
                            "flex aspect-square items-center justify-center rounded-lg border",
                            asset.kind === "reversed"
                              ? "border-[#2a2a32] bg-[#16161c]"
                              : "border-[#ece8e0] bg-[#fbfaf7]",
                          )}
                        >
                          <ConceptImage
                            assetId={asset.assetId}
                            alt={`${current.name} ${asset.kind}`}
                            className="h-full w-full !rounded-none"
                            padded={false}
                            imgClassName="p-4"
                            bare
                          />
                        </div>
                        <p className="mt-2 text-center text-[10px] uppercase tracking-[0.1em] text-[#8c887f]">
                          {asset.kind}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Prev / next */}
          {concepts.length > 1 ? (
            <div className="no-print mt-6 flex items-center justify-between">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => setIndex((i) => i - 1)}
                className="inline-flex items-center gap-1.5 text-[13px] text-[#6b6862] transition-colors hover:text-[#16161c] disabled:opacity-30"
              >
                <ChevronLeft size={15} />
                Previous
              </button>
              <span className="text-[12px] text-[#8c887f]">
                {index + 1} of {concepts.length}
              </span>
              <button
                type="button"
                disabled={index === concepts.length - 1}
                onClick={() => setIndex((i) => i + 1)}
                className="inline-flex items-center gap-1.5 text-[13px] text-[#6b6862] transition-colors hover:text-[#16161c] disabled:opacity-30"
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
          ) : null}
        </article>

        {/* Feedback */}
        <section className="no-print mx-auto mt-14 max-w-2xl">
          {sent ? (
            <div className="flex items-center gap-3 rounded-xl border border-[#c3ddc9] bg-[#eef6f0] px-5 py-4">
              <Check size={16} className="shrink-0 text-[#3f7d53]" />
              <p className="text-[13px] text-[#2f5c3e]">{sent}</p>
            </div>
          ) : (
            <>
              <h3 className="text-center font-[family-name:var(--font-display)] text-xl">
                What do you think?
              </h3>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-[#6b6862]">
                Your comments go straight to the design team. Be as specific or as
                instinctive as you like — &ldquo;it feels too cold&rdquo; is genuinely useful.
              </p>

              <div className="mt-6 rounded-xl border border-[#e4dfd6] bg-white p-5">
                <p className="mb-3 text-[12px] text-[#8c887f]">
                  About <span className="text-[#16161c]">{current.name}</span>
                </p>
                <textarea
                  rows={4}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="I like the symbol but the type feels too technical…"
                  className="w-full rounded-lg border border-[#ded9d0] bg-[#fbfaf7] px-3.5 py-3 text-[13px] leading-relaxed text-[#16161c] placeholder:text-[#a8a49a] focus:border-[#16161c] focus:outline-none"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => submit(current.id, "approved")}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#16161c] px-4 py-2.5 text-[13px] font-medium text-[#f7f5f0] transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Check size={14} />
                    Approve this concept
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !draft.trim()}
                    onClick={() => submit(current.id, "changes_requested")}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#ded9d0] px-4 py-2.5 text-[13px] text-[#3c3a35] transition-colors hover:border-[#b8b2a6] disabled:opacity-40"
                  >
                    <Send size={13} />
                    Request changes
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !draft.trim()}
                    onClick={() => submit(current.id, "pending")}
                    className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] text-[#6b6862] transition-colors hover:text-[#16161c] disabled:opacity-40"
                  >
                    <MessageSquare size={13} />
                    Just leave a comment
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="no-print mt-16 border-t border-[#e4dfd6] py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 text-[11px] text-[#a8a49a]">
          <SigilGlyph size={11} />
          <span className="tracking-[0.2em]">SIGIL</span>
        </div>
      </footer>
    </div>
  );
}
