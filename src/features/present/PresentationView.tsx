"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquare,
  Printer,
  Send,
  X,
} from "lucide-react";
import { SigilGlyph } from "@/components/brand/SigilLogo";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Primitives";
import { assetUrl } from "@/services/db/assetStore";
import { projectRepository, updateProject } from "@/services/db/repository";
import type { ClientDecision } from "@/types";
import { cn } from "@/utils/cn";
import {
  MAX_FEEDBACK_LENGTH,
  presentationOf,
  withClientFeedback,
  type PresentedConcept,
  type Presentation,
} from "./presentation";

/**
 * Client presentation mode.
 *
 * A deliberately different surface: light, quiet, gallery-like. It shows the
 * work, the logo on real surfaces, and the thinking behind it, and nothing
 * else: it renders from the client-safe projection in `presentation.ts`, so
 * concept codes, ratings, AI critiques, prompts, rejected concepts, model
 * names and the designer's private notes never reach it.
 *
 * Two sources: the public share link (`/share/<token>`, no sign-in, served by
 * /api/share) and the designer's signed-in preview (`/present/<id>`).
 * Printing gives every concept, each followed by a page of its mockups.
 */

export type PresentationSource = { kind: "project"; id: string } | { kind: "share"; token: string };

export function PresentationView({ source }: { source: PresentationSource }) {
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const sourceKey = source.kind === "share" ? `s:${source.token}` : `p:${source.id}`;

  const load = useCallback(async (): Promise<Presentation | null> => {
    if (source.kind === "project") {
      const project = await projectRepository.get(source.id);
      return project ? presentationOf(project) : null;
    }
    const res = await fetch(`/api/share/${encodeURIComponent(source.token)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { presentation: Presentation }).presentation;
    // sourceKey stands for `source`, whose identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  useEffect(() => {
    let active = true;
    void load()
      .catch(() => null)
      .then((loaded) => {
        if (!active) return;
        setPresentation(loaded);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  const imageSrc = (assetId: string) =>
    source.kind === "share"
      ? `/api/share/${encodeURIComponent(source.token)}/assets/${encodeURIComponent(assetId)}`
      : assetUrl(assetId);

  const concepts = presentation?.concepts ?? [];
  const current = concepts[Math.min(index, Math.max(0, concepts.length - 1))];
  const mockups = current?.mockups ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (viewing !== null) {
        if (e.key === "Escape") setViewing(null);
        if (e.key === "ArrowRight") setViewing((v) => (v === null ? v : (v + 1) % mockups.length));
        if (e.key === "ArrowLeft") setViewing((v) => (v === null ? v : (v - 1 + mockups.length) % mockups.length));
        return;
      }
      if ((e.target as HTMLElement | null)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, concepts.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [concepts.length, mockups.length, viewing]);

  const submit = async (conceptId: string | undefined, decision: ClientDecision) => {
    if (decision !== "approved" && !draft.trim()) return;
    setSubmitting(true);
    setFailed(null);
    try {
      const input = { conceptId, decision, body: draft.trim() };
      if (source.kind === "project") {
        // Applied to the latest saved copy, so feedback never overwrites the
        // design team's work if they saved while this page was open.
        setPresentation(presentationOf(await updateProject(source.id, (p) => withClientFeedback(p, input))));
      } else {
        const res = await fetch(`/api/share/${encodeURIComponent(source.token)}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? "Your feedback could not be sent. Please try again.");
        }
      }
      setDraft("");
      setSent(
        decision === "approved"
          ? "Thank you — your approval has been sent to the design team."
          : "Thank you — your feedback has been sent to the design team.",
      );
      setTimeout(() => setSent(null), 6000);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Your feedback could not be sent. Please try again.");
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

  if (!presentation || !current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f0] px-6 text-center">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[#16161c]">
            Nothing to show yet
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-[#6b6862]">
            {source.kind === "share"
              ? "This presentation is not available. Your design team will send a new link when it is ready."
              : "No concepts are marked for the client yet."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#16161c]">
      {source.kind === "project" ? (
        <div className="no-print bg-[#16161c] px-6 py-2 text-center text-[12px] text-[#f7f5f0]">
          <Eye size={12} className="mr-1.5 inline -translate-y-px" />
          Designer preview{presentation.published ? "" : " — not published, so the client link is off"}. The
          client sees exactly this, without this bar.
        </div>
      ) : null}

      {/* Header */}
      <header className="no-print sticky top-0 z-30 border-b border-[#ded9d0] bg-[#f7f5f0]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <div className="min-w-0">
            <h1 className="truncate font-[family-name:var(--font-display)] text-lg">{presentation.title}</h1>
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

      <main className="mx-auto max-w-6xl px-6 py-10 print:max-w-none print:p-0">
        {presentation.intro ? (
          <p className="mx-auto mb-12 max-w-2xl text-center font-[family-name:var(--font-display)] text-[19px] leading-relaxed text-[#3c3a35] print:hidden">
            {presentation.intro}
          </p>
        ) : null}

        {/* Concept navigation */}
        {concepts.length > 1 ? (
          <nav className="no-print mb-8 flex flex-wrap items-center justify-center gap-2">
            {concepts.map((concept, i) => (
              <button
                key={concept.id}
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-[12px] transition-colors",
                  concept.id === current.id
                    ? "border-[#16161c] bg-[#16161c] text-[#f7f5f0]"
                    : "border-[#ded9d0] text-[#6b6862] hover:border-[#b8b2a6]",
                )}
              >
                {concept.name}
              </button>
            ))}
          </nav>
        ) : null}

        {/* The work: on screen the selected concept; in print, every one. */}
        {concepts.map((concept) => (
          <div key={concept.id} className={concept.id === current.id ? undefined : "hidden print:block"}>
            <ConceptPages concept={concept} imageSrc={imageSrc} onOpenMockup={setViewing} />
          </div>
        ))}

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

        {/* Feedback */}
        <section className="no-print mx-auto mt-14 max-w-2xl">
          {sent ? (
            <div className="flex items-center gap-3 rounded-xl border border-[#c3ddc9] bg-[#eef6f0] px-5 py-4">
              <Check size={16} className="shrink-0 text-[#3f7d53]" />
              <p className="text-[13px] text-[#2f5c3e]">{sent}</p>
            </div>
          ) : (
            <>
              <h3 className="text-center font-[family-name:var(--font-display)] text-xl">What do you think?</h3>
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
                  maxLength={MAX_FEEDBACK_LENGTH}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="I like the symbol but the type feels too technical…"
                  className="w-full rounded-lg border border-[#ded9d0] bg-[#fbfaf7] px-3.5 py-3 text-[13px] leading-relaxed text-[#16161c] placeholder:text-[#a8a49a] focus:border-[#16161c] focus:outline-none"
                />
                {failed ? <p className="mt-2 text-[12px] text-[#b3402f]">{failed}</p> : null}

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

      {viewing !== null && mockups[viewing] ? (
        <Lightbox
          src={imageSrc(mockups[viewing].assetId)}
          label={mockups[viewing].label}
          name={current.name}
          position={`${viewing + 1} of ${mockups.length}`}
          onClose={() => setViewing(null)}
          onPrev={mockups.length > 1 ? () => setViewing((viewing - 1 + mockups.length) % mockups.length) : undefined}
          onNext={mockups.length > 1 ? () => setViewing((viewing + 1) % mockups.length) : undefined}
        />
      ) : null}
    </div>
  );
}

/** One concept: the mark and its rationale, then (its own printed page) the mark in use. */
function ConceptPages({
  concept,
  imageSrc,
  onOpenMockup,
}: {
  concept: PresentedConcept;
  imageSrc: (assetId: string) => string;
  onOpenMockup: (index: number) => void;
}) {
  const card =
    "rounded-2xl border border-[#e4dfd6] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_44px_-24px_rgba(0,0,0,0.18)] print-surface sm:p-12 print:rounded-none print:border-0 print:p-0";

  return (
    <>
      <article className="print-page">
        <div className={card}>
          <div className="mx-auto flex aspect-[16/9] max-w-3xl items-center justify-center print:aspect-[16/7]">
            {concept.primaryAssetId ? (
              <img
                src={imageSrc(concept.primaryAssetId)}
                alt={concept.name}
                className="h-full w-full object-contain p-4"
              />
            ) : null}
          </div>

          <div className="mx-auto mt-10 max-w-2xl text-center print:mt-4">
            <h2 className="font-[family-name:var(--font-display)] text-[28px] leading-tight">{concept.name}</h2>
            <p className="mt-4 text-[14px] leading-relaxed text-[#4a4842] print:mt-2 print:text-[12px]">
              {concept.rationale}
            </p>
          </div>

          {concept.lockups.length > 0 ? (
            <div className="mx-auto mt-12 max-w-4xl border-t border-[#ece8e0] pt-8 print:mt-5 print:pt-4">
              <p className="mb-5 text-center text-[10px] uppercase tracking-[0.18em] text-[#8c887f] print:mb-3">
                How it works across applications
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-8 print:gap-2">
                {concept.lockups.map((lockup) => (
                  <div key={lockup.assetId}>
                    <div
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-lg border",
                        lockup.kind === "reversed" ? "border-[#2a2a32] bg-[#16161c]" : "border-[#ece8e0] bg-[#fbfaf7]",
                      )}
                    >
                      <img
                        src={imageSrc(lockup.assetId)}
                        alt={`${concept.name} ${lockup.kind}`}
                        className="h-full w-full object-contain p-4 print:p-2"
                      />
                    </div>
                    <p className="mt-2 text-center text-[10px] uppercase tracking-[0.1em] text-[#8c887f]">
                      {lockup.kind}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </article>

      {concept.mockups.length > 0 ? (
        <section className="print-page mt-6 print:mt-0">
          <div className={card}>
            <div className="mb-6 text-center print:mb-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#8c887f]">In use</p>
              <h3 className="mt-1 font-[family-name:var(--font-display)] text-[20px] print:text-[16px]">
                {concept.name} on real surfaces
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
              {concept.mockups.map((mockup, i) => (
                <figure key={mockup.assetId} className="break-inside-avoid">
                  <button
                    type="button"
                    onClick={() => onOpenMockup(i)}
                    className="group block w-full overflow-hidden rounded-lg bg-[#ece8e0] print:rounded"
                  >
                    <img
                      src={imageSrc(mockup.assetId)}
                      alt={`${concept.name} — ${mockup.label}`}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </button>
                  <figcaption className="mt-2 text-center text-[11px] text-[#6b6862] print:mt-1 print:text-[9px]">
                    {mockup.label}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="no-print mt-5 text-center text-[11px] text-[#a8a49a]">
              Photographic previews of how the mark will look applied. Click one to see it large.
            </p>
          </div>
        </section>
      ) : null}
    </>
  );
}

function Lightbox({
  src,
  label,
  name,
  position,
  onClose,
  onPrev,
  onNext,
}: {
  src: string;
  label: string;
  name: string;
  position: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const arrow =
    "absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} — ${label}`}
      className="no-print fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6"
      onClick={onClose}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-5 top-5 rounded-full p-2 text-white/80 hover:text-white">
        <X size={22} />
      </button>
      <img
        src={src}
        alt={`${name} — ${label}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[82vh] max-w-full rounded-lg object-contain"
      />
      <p className="mt-4 text-[13px] text-white/85">
        {label} <span className="text-white/45">· {position}</span>
      </p>
      {onPrev ? (
        <button type="button" aria-label="Previous" className={cn(arrow, "left-5")} onClick={(e) => { e.stopPropagation(); onPrev(); }}>
          <ChevronLeft size={20} />
        </button>
      ) : null}
      {onNext ? (
        <button type="button" aria-label="Next" className={cn(arrow, "right-5")} onClick={(e) => { e.stopPropagation(); onNext(); }}>
          <ChevronRight size={20} />
        </button>
      ) : null}
    </div>
  );
}
