"use client";

import { ConceptImage } from "@/components/ConceptImage";
import { Badge, Modal } from "@/components/ui/Primitives";
import { useLoadedProject } from "@/hooks/useProject";
import type { LogoConcept } from "@/types";

/**
 * Comparison mode (spec §18).
 *
 * Deliberately does not rank. Every concept gets identical treatment across the
 * same set of objective renders, and the AI's observations sit beside the
 * designer's own notes rather than above them.
 */
export function CompareModal({
  conceptIds,
  onClose,
}: {
  conceptIds: string[];
  onClose: () => void;
}) {
  const { project } = useLoadedProject();
  const concepts = conceptIds
    .map((id) => project.concepts.find((c) => c.id === id))
    .filter(Boolean) as LogoConcept[];

  if (!concepts.length) return null;

  const rows: Array<{
    label: string;
    render: (concept: LogoConcept) => React.ReactNode;
  }> = [
    {
      label: "Full logo",
      render: (c) => (
        <ConceptImage assetId={c.primaryAssetId} alt={c.name} imgClassName="p-4" />
      ),
    },
    {
      label: "Pure black & white",
      render: (c) => (
        <ConceptImage assetId={c.primaryAssetId} alt={c.name} mode="onebit" imgClassName="p-4" />
      ),
    },
    {
      label: "Reversed on dark",
      render: (c) => (
        <ConceptImage
          assetId={c.primaryAssetId}
          alt={c.name}
          mode="inverted"
          dark
          imgClassName="p-4"
        />
      ),
    },
    {
      label: "At 48 pixels",
      render: (c) => (
        <div className="flex items-center justify-center py-4">
          <ConceptImage
            assetId={c.primaryAssetId}
            alt={c.name}
            mode="small"
            className="h-12 w-12"
            padded={false}
          />
        </div>
      ),
    },
    {
      label: "Symbol only",
      render: (c) => {
        const symbol = c.assets.find((a) => a.kind === "symbol");
        return symbol ? (
          <ConceptImage assetId={symbol.assetId} alt={`${c.name} symbol`} imgClassName="p-4" />
        ) : (
          <p className="px-3 py-6 text-center text-[11px] text-faint">
            Not generated yet — built during the finalist stage
          </p>
        );
      },
    },
    {
      label: "Wordmark only",
      render: (c) => {
        const wordmark = c.assets.find((a) => a.kind === "wordmark");
        return wordmark ? (
          <ConceptImage assetId={wordmark.assetId} alt={`${c.name} wordmark`} imgClassName="p-4" />
        ) : (
          <p className="px-3 py-6 text-center text-[11px] text-faint">
            Not generated yet — built during the finalist stage
          </p>
        );
      },
    },
    {
      label: "AI observations",
      render: (c) =>
        c.critique ? (
          <div className="space-y-2 px-1 py-2">
            <p className="text-[11px] leading-relaxed text-muted">{c.critique.summary}</p>
            <ul className="space-y-1">
              {c.critique.observations.slice(0, 4).map((o, i) => (
                <li key={i} className="text-[11px] leading-snug text-faint">
                  · {o}
                </li>
              ))}
            </ul>
            {c.critique.technicalProblems.length ? (
              <p className="text-[11px] leading-snug text-danger/80">
                {c.critique.technicalProblems.join("; ")}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="px-3 py-6 text-center text-[11px] text-faint">
            No critique run yet
          </p>
        ),
    },
    {
      label: "Your notes",
      render: (c) => {
        const notes = c.comments.map((x) => x.body);
        return notes.length ? (
          <ul className="space-y-1.5 px-1 py-2">
            {notes.map((note, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-muted">
                {note}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-6 text-center text-[11px] text-faint">No notes</p>
        );
      },
    },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="full"
      title={`Comparing ${concepts.length} concepts`}
      description="Objective renders side by side, in identical conditions. Nothing here is ranked — the judgement is yours."
    >
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-32 bg-surface pb-3 pr-4 text-left align-bottom">
                <span className="label-xs">Condition</span>
              </th>
              {concepts.map((c) => (
                <th
                  key={c.id}
                  className="min-w-[200px] pb-3 pl-4 text-left align-bottom"
                  style={{ width: `${100 / concepts.length}%` }}
                >
                  <span className="block font-mono text-[11px] text-faint">{c.code}</span>
                  <span className="block truncate text-[13px] font-normal text-ink">
                    {c.name}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    <Badge tone="neutral">{c.status}</Badge>
                    {c.rating > 0 ? <Badge tone="accent">{c.rating}/5</Badge> : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="sticky left-0 z-10 border-t border-line bg-surface py-4 pr-4 align-top">
                  <span className="text-[12px] text-muted">{row.label}</span>
                </td>
                {concepts.map((c) => (
                  <td key={c.id} className="border-t border-line py-4 pl-4 align-top">
                    {row.render(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
