"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Code2,
  Download,
  GitBranch,

  Sparkles,
  Type,
} from "lucide-react";
import { ConceptImage, type RenderMode } from "@/components/ConceptImage";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Badge, Modal, Tabs } from "@/components/ui/Primitives";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import { useLoadedProject } from "@/hooks/useProject";
import { resolveGenerationSettings, useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/useToast";
import {
  critiqueLogoConcept,
  recommendFonts,
  runQualityCheck,
} from "@/services/gemini";
import { GeminiError } from "@/services/gemini/errors";
import { getAssetBase64 } from "@/services/db/assetStore";
import type { ConceptStatus, LogoConcept } from "@/types";
import {
  commentOnConcept,
  makeComment,
  setConceptStatus,
  updateConcept,
} from "@/workflows/mutations";
import { timelineEvent } from "@/workflows/projectFactory";
import { formatRelative } from "@/utils/format";
import { downloadBlob } from "@/utils/download";
import { toPngBlob } from "@/utils/image";
import { cn } from "@/utils/cn";

type Tab = "overview" | "critique" | "typography" | "lineage" | "technical";

export function ConceptDetail({
  conceptId,
  onClose,
  onIterate,
  onNavigate,
}: {
  conceptId: string;
  onClose: () => void;
  onIterate?: (id: string) => void;
  onNavigate?: (id: string) => void;
}) {
  const { project, update } = useLoadedProject();
  const { settings } = useSettings();
  const { push } = useToast();

  const [tab, setTab] = useState<Tab>("overview");
  const [mode, setMode] = useState<RenderMode>("normal");
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const concept = project.concepts.find((c) => c.id === conceptId);
  const url = useAssetUrl(concept?.primaryAssetId);
  const generationSettings = resolveGenerationSettings(settings, project);

  if (!concept) return null;

  const direction = project.directions.find((d) => d.id === concept.directionId);
  const parent = concept.parentConceptId
    ? project.concepts.find((c) => c.id === concept.parentConceptId)
    : undefined;
  const children = project.concepts.filter((c) => c.parentConceptId === concept.id);

  /* ----------------------------- actions ----------------------------- */

  const setStatus = (status: ConceptStatus) =>
    update(
      (p) => setConceptStatus(p, concept.id, status),
      timelineEvent(
        "decision",
        `${concept.code} marked ${status}`,
        concept.name,
        project.stage,
      ),
    );

  const runCritique = async () => {
    setBusy("critique");
    try {
      const image = concept.primaryAssetId
        ? await getAssetBase64(concept.primaryAssetId)
        : null;
      const critique = await critiqueLogoConcept(
        project,
        concept,
        generationSettings,
        image ?? undefined,
      );
      await update(
        (p) => updateConcept(p, concept.id, { critique }),
        timelineEvent("ai", `Design critique of ${concept.code}`, undefined, project.stage),
      );
      setTab("critique");
    } catch (err) {
      push({
        tone: "error",
        title: "Critique failed",
        body: GeminiError.from(err).message,
      });
    } finally {
      setBusy(null);
    }
  };

  const runCheck = async () => {
    setBusy("quality");
    try {
      const image = concept.primaryAssetId
        ? await getAssetBase64(concept.primaryAssetId)
        : null;
      const qualityCheck = await runQualityCheck(
        project,
        concept,
        generationSettings,
        image ?? undefined,
      );
      await update((p) => updateConcept(p, concept.id, { qualityCheck }), null);
      setTab("critique");
    } catch (err) {
      push({ tone: "error", title: "Quality check failed", body: GeminiError.from(err).message });
    } finally {
      setBusy(null);
    }
  };

  const loadFonts = async () => {
    setBusy("fonts");
    try {
      const result = await recommendFonts(project, concept, generationSettings);
      await update(
        (p) =>
          updateConcept(p, concept.id, (c) => ({
            typography: {
              ...c.typography,
              fontRecommendations: result.fonts,
              issueNote: c.typography.issueNote || result.wordmarkNotes,
            },
          })),
        null,
      );
    } catch (err) {
      push({ tone: "error", title: "Could not load fonts", body: GeminiError.from(err).message });
    } finally {
      setBusy(null);
    }
  };

  const addNote = async () => {
    if (!noteDraft.trim()) return;
    await update((p) => commentOnConcept(p, concept.id, makeComment(noteDraft)), null);
    setNoteDraft("");
  };

  const download = async () => {
    if (!url) return;
    const blob = await toPngBlob(url);
    downloadBlob(blob, `${project.companyName}-${concept.code}.png`);
  };

  /* ------------------------------ view ------------------------------- */

  return (
    <Modal
      open
      onClose={onClose}
      size="full"
      title={`${concept.code} — ${concept.name}`}
      description={direction ? `${direction.number}. ${direction.name}` : undefined}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={concept.status === "favorite" ? "accent" : "secondary"}
              onClick={() => setStatus(concept.status === "favorite" ? "new" : "favorite")}
            >
              Favourite
            </Button>
            <Button
              size="sm"
              variant={concept.status === "shortlisted" ? "accent" : "secondary"}
              onClick={() => setStatus(concept.status === "shortlisted" ? "new" : "shortlisted")}
            >
              Shortlist
            </Button>
            <Button
              size="sm"
              variant={concept.status === "finalist" ? "accent" : "secondary"}
              onClick={() => setStatus(concept.status === "finalist" ? "shortlisted" : "finalist")}
            >
              {concept.status === "finalist" ? "Remove finalist" : "Promote to finalist"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setStatus(concept.status === "rejected" ? "new" : "rejected")}
            >
              {concept.status === "rejected" ? "Restore" : "Reject"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" icon={<Download size={13} />} onClick={download}>
              PNG
            </Button>
            {onIterate ? (
              <Button
                size="sm"
                variant="accent"
                icon={<GitBranch size={13} />}
                onClick={() => onIterate(concept.id)}
              >
                Generate variations
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,460px)_1fr]">
        {/* --------------------------- artwork --------------------------- */}
        <div>
          <ConceptImage
            assetId={concept.primaryAssetId}
            alt={concept.name}
            mode={mode}
            dark={mode === "inverted"}
            className="w-full"
            imgClassName="p-6"
          />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(
              [
                ["normal", "Colour"],
                ["grayscale", "Greyscale"],
                ["onebit", "Pure B/W"],
                ["inverted", "Reversed"],
                ["small", "48px"],
              ] as Array<[RenderMode, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] transition-colors",
                  mode === value
                    ? "bg-surface-4 text-ink"
                    : "text-muted hover:bg-white/5 hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            These are true canvas conversions, not CSS filters — what you see here is what
            the artwork actually does.
          </p>

          {/* Designer's private notes */}
          <div className="mt-5">
            <p className="label-xs mb-2">Your notes</p>
            {concept.comments.length > 0 ? (
              <ul className="mb-2 space-y-1.5">
                {concept.comments.map((comment) => (
                  <li key={comment.id} className="rounded-lg bg-surface-2 px-3 py-2">
                    <p className="text-[12px] leading-relaxed text-muted">{comment.body}</p>
                    <p className="mt-1 text-[10px] text-faint">
                      {comment.author === "client" ? "Client · " : ""}
                      {formatRelative(comment.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            <Textarea
              rows={2}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="What works, what does not…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void addNote();
              }}
            />
            {noteDraft.trim() ? (
              <Button size="sm" variant="secondary" className="mt-2" onClick={addNote}>
                Add note
              </Button>
            ) : null}
          </div>
        </div>

        {/* ---------------------------- detail --------------------------- */}
        <div className="min-w-0">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "overview", label: "Overview" },
              { value: "critique", label: "AI critique" },
              { value: "typography", label: "Typography" },
              { value: "lineage", label: "Lineage", count: children.length },
              { value: "technical", label: "Technical" },
            ]}
            className="mb-5"
          />

          {tab === "overview" ? (
            <div className="space-y-5">
              <Detail label="Concept objective">{concept.objective}</Detail>
              <Detail label="Description">{concept.description}</Detail>
              <Detail label="Design rationale">{concept.rationale}</Detail>
              {direction ? (
                <Detail label="Creative territory">
                  <span className="text-ink">{direction.name}</span> — {direction.concept}
                </Detail>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge tone="neutral">Status: {concept.status}</Badge>
                {concept.rating > 0 ? (
                  <Badge tone="accent">Rated {concept.rating}/5</Badge>
                ) : null}
                <Badge tone="neutral">{formatRelative(concept.createdAt)}</Badge>
              </div>
            </div>
          ) : null}

          {tab === "critique" ? (
            <CritiqueTab
              concept={concept}
              busy={busy}
              onCritique={runCritique}
              onQualityCheck={runCheck}
            />
          ) : null}

          {tab === "typography" ? (
            <TypographyTab
              concept={concept}
              busy={busy === "fonts"}
              onLoadFonts={loadFonts}
              onVerify={(verified, note) =>
                update(
                  (p) =>
                    updateConcept(p, concept.id, (c) => ({
                      typography: {
                        ...c.typography,
                        renderedTextVerified: verified,
                        issueNote: note,
                      },
                    })),
                  null,
                )
              }
              onSetName={(name) =>
                update(
                  (p) =>
                    updateConcept(p, concept.id, (c) => ({
                      typography: { ...c.typography, exactCompanyName: name },
                    })),
                  null,
                )
              }
            />
          ) : null}

          {tab === "lineage" ? (
            <div className="space-y-4">
              {parent ? (
                <div>
                  <p className="label-xs mb-2">Derived from</p>
                  <button
                    type="button"
                    onClick={() => onNavigate?.(parent.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface-2 p-2.5 text-left transition-colors hover:border-line-strong"
                  >
                    <ConceptImage
                      assetId={parent.primaryAssetId}
                      alt={parent.name}
                      className="h-12 w-12 shrink-0"
                      imgClassName="p-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-ink">
                        {parent.code} · {parent.name}
                      </span>
                      <span className="block truncate text-[11px] text-faint">
                        {parent.objective}
                      </span>
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-faint" />
                  </button>
                </div>
              ) : (
                <p className="text-[12px] text-muted">
                  This is an original exploration concept — it has no parent.
                </p>
              )}

              {children.length > 0 ? (
                <div>
                  <p className="label-xs mb-2">Variations generated from this</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onNavigate?.(child.id)}
                        className="rounded-lg border border-line p-1.5 text-left transition-colors hover:border-line-strong"
                      >
                        <ConceptImage
                          assetId={child.primaryAssetId}
                          alt={child.name}
                          imgClassName="p-2"
                        />
                        <span className="mt-1.5 block truncate px-1 text-[11px] text-muted">
                          {child.code}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {concept.lineage.length > 0 ? (
                <div>
                  <p className="label-xs mb-2">Full ancestry</p>
                  <p className="font-mono text-[11px] text-muted">
                    {[...concept.lineage, concept.id]
                      .map((id) => project.concepts.find((c) => c.id === id)?.code ?? "?")
                      .join("  →  ")}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "technical" ? (
            <div className="space-y-4">
              {concept.assets.map((asset) => (
                <div key={asset.assetId} className="rounded-lg border border-line bg-surface-2 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge tone="neutral">{asset.kind}</Badge>
                    <span className="text-[11px] text-faint">
                      {asset.meta.model} · {asset.meta.durationMs
                        ? `${(asset.meta.durationMs / 1000).toFixed(1)}s`
                        : "—"}
                    </span>
                  </div>
                  <details>
                    <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] text-faint hover:text-muted">
                      <Code2 size={11} />
                      Generation prompt
                    </summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-void/60 p-3 font-mono text-[10px] leading-relaxed text-muted">
                      {asset.meta.prompt}
                    </pre>
                  </details>
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-faint">
                Prompts and model details are internal. They are never shown in the client
                presentation.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-xs mb-1.5">{label}</p>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function CritiqueTab({
  concept,
  busy,
  onCritique,
  onQualityCheck,
}: {
  concept: LogoConcept;
  busy: string | null;
  onCritique: () => void;
  onQualityCheck: () => void;
}) {
  const { critique, qualityCheck } = concept;

  const dimensions = critique
    ? ([
        ["Distinctiveness", critique.distinctiveness],
        ["Memorability", critique.memorability],
        ["Scalability", critique.scalability],
        ["Legibility", critique.legibility],
        ["Symbolism", critique.symbolism],
        ["Typography", critique.typography],
        ["Balance", critique.balance],
        ["Simplicity", critique.simplicity],
        ["Reproduction", critique.reproduction],
        ["Small size", critique.smallSize],
        ["Black & white", critique.blackAndWhite],
      ] as const)
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={critique ? "ghost" : "accent"}
          icon={busy === "critique" ? undefined : <Sparkles size={13} />}
          loading={busy === "critique"}
          onClick={onCritique}
        >
          {critique ? "Re-run critique" : "Run design critique"}
        </Button>
        <Button
          size="sm"
          variant={qualityCheck ? "ghost" : "secondary"}
          icon={busy === "quality" ? undefined : <Check size={13} />}
          loading={busy === "quality"}
          onClick={onQualityCheck}
        >
          {qualityCheck ? "Re-run quality check" : "Run quality checklist"}
        </Button>
      </div>

      {!critique && !qualityCheck ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[12px] leading-relaxed text-muted">
          The critic analyses the generated artwork against the brief and against production
          reality. It never picks a winner — that decision stays with you.
        </p>
      ) : null}

      {critique ? (
        <>
          <div>
            <p className="label-xs mb-2">Summary</p>
            <p className="text-[13px] leading-relaxed text-muted">{critique.summary}</p>
          </div>

          <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
            {dimensions.map(([label, value]) => (
              <div key={label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-ink">{label}</span>
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      value.score >= 8
                        ? "text-success"
                        : value.score >= 6
                          ? "text-muted"
                          : "text-caution",
                    )}
                  >
                    {value.score}/10
                  </span>
                </div>
                <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-white/8">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      value.score >= 8
                        ? "bg-success"
                        : value.score >= 6
                          ? "bg-muted"
                          : "bg-caution",
                    )}
                    style={{ width: `${value.score * 10}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] leading-snug text-faint">{value.note}</p>
              </div>
            ))}
          </div>

          <ListBlock label="Strengths" items={critique.strengths} tone="success" />
          <ListBlock label="Concerns" items={critique.concerns} tone="caution" />
          <ListBlock
            label="Technical problems"
            items={critique.technicalProblems}
            tone="danger"
          />
          <ListBlock label="Neutral observations" items={critique.observations} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Detail label="Brand confusion risk">{critique.brandConfusionRisk}</Detail>
            <Detail label="Genericness risk">{critique.genericnessRisk}</Detail>
          </div>
          <Detail label="Brief alignment">{critique.briefAlignment}</Detail>
        </>
      ) : null}

      {qualityCheck ? (
        <div className="border-t border-line pt-5">
          <p className="label-xs mb-3">Production quality checklist</p>
          <ul className="space-y-2">
            {qualityCheck.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0">
                  {item.verdict === "pass" ? (
                    <Check size={12} className="text-success" />
                  ) : item.verdict === "caution" ? (
                    <AlertTriangle size={12} className="text-caution" />
                  ) : (
                    <AlertTriangle size={12} className="text-danger" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] text-ink">{item.question}</span>
                  <span className="block text-[11px] leading-snug text-muted">{item.note}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            {qualityCheck.overallNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ListBlock({
  label,
  items,
  tone = "neutral",
}: {
  label: string;
  items: string[];
  tone?: "neutral" | "success" | "caution" | "danger";
}) {
  if (!items.length) return null;
  const colors = {
    neutral: "text-muted",
    success: "text-success/90",
    caution: "text-caution/90",
    danger: "text-danger/90",
  };
  return (
    <div>
      <p className="label-xs mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={cn("text-[12px] leading-relaxed", colors[tone])}>
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TypographyTab({
  concept,
  busy,
  onLoadFonts,
  onVerify,
  onSetName,
}: {
  concept: LogoConcept;
  busy: boolean;
  onLoadFonts: () => void;
  onVerify: (verified: boolean, note: string) => void;
  onSetName: (name: string) => void;
}) {
  const [name, setName] = useState(concept.typography.exactCompanyName);
  const [note, setNote] = useState(concept.typography.issueNote ?? "");

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-caution/25 bg-caution/8 p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-caution" />
          <div>
            <p className="text-[12px] font-medium text-ink">
              Text inside a generated image is not production-ready
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Image models routinely misspell words and produce malformed letterforms. The
              symbol is the asset worth keeping; the wordmark should be reset in a real
              typeface before anything ships.
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="label-xs mb-2">Authoritative company name</p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onSetName(name)}
            className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink"
          />
        </div>
        <p className="mt-1.5 text-[11px] text-faint">
          This exact string is injected into every future generation and lockup.
        </p>
      </div>

      <div>
        <p className="label-xs mb-2">Rendered text check</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={concept.typography.renderedTextVerified ? "accent" : "secondary"}
            onClick={() => onVerify(true, note)}
          >
            Letterforms are correct
          </Button>
          <Button
            size="sm"
            variant={!concept.typography.renderedTextVerified ? "danger" : "secondary"}
            onClick={() => onVerify(false, note)}
          >
            Needs rebuilding
          </Button>
        </div>
        <Textarea
          rows={2}
          className="mt-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onVerify(concept.typography.renderedTextVerified, note)}
          placeholder='e.g. "reads NEXORRA — the wordmark has to be reset"'
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="label-xs">Typeface recommendations</p>
          <Button
            size="sm"
            variant="ghost"
            loading={busy}
            icon={busy ? undefined : <Type size={12} />}
            onClick={onLoadFonts}
          >
            {concept.typography.fontRecommendations.length ? "Refresh" : "Recommend typefaces"}
          </Button>
        </div>

        {concept.typography.fontRecommendations.length === 0 ? (
          <p className="text-[12px] text-muted">
            Ask for typefaces that suit this mark&apos;s geometry, so the wordmark can be
            rebuilt properly.
          </p>
        ) : (
          <ul className="space-y-2">
            {concept.typography.fontRecommendations.map((font, i) => (
              <li key={i} className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13px] text-ink">{font.family}</span>
                  <span className="text-[11px] text-faint">
                    {font.category} · {font.weight}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{font.why}</p>
                {font.pairing || font.source ? (
                  <p className="mt-1.5 text-[10px] text-faint">
                    {font.pairing ? `Pairs with ${font.pairing}` : ""}
                    {font.pairing && font.source ? " · " : ""}
                    {font.source ?? ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
