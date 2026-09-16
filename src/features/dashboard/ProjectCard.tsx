"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Copy,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { ConceptImage } from "@/components/ConceptImage";
import { Badge, ProgressBar } from "@/components/ui/Primitives";
import { IconButton } from "@/components/ui/Button";
import { SigilGlyph } from "@/components/brand/SigilLogo";
import { STAGE_BY_ID } from "@/workflows/stages";
import type { ProjectSummary } from "@/types";
import { formatRelative } from "@/utils/format";
import { cn } from "@/utils/cn";

export function ProjectCard({
  project,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  project: ProjectSummary;
  onDuplicate: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const stage = STAGE_BY_ID[project.stage];
  const archived = project.status === "archived";

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all duration-200",
        "hover:border-line-strong hover:shadow-lift",
        archived && "opacity-60",
      )}
    >
      <Link
        href={`/projects/${project.id}`}
        className="flex flex-1 flex-col focus-visible:outline-none"
      >
        {/* Cover: the most advanced piece of artwork in the project. */}
        <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-surface-2">
          {project.coverAssetId ? (
            <ConceptImage
              assetId={project.coverAssetId}
              alt={`${project.companyName} logo concept`}
              className="h-full w-full rounded-none"
              padded={false}
              imgClassName="p-8 transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#101016,#0b0b0f)]">
              <SigilGlyph size={26} className="text-white/8" />
            </div>
          )}

          <div className="absolute left-3 top-3 flex gap-1.5">
            {project.isDemo ? <Badge tone="violet">Sample</Badge> : null}
            {archived ? <Badge tone="neutral">Archived</Badge> : null}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] text-ink">{project.companyName}</h3>
              <p className="mt-0.5 truncate text-[11px] text-faint">
                {project.industry || "No industry set"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Badge tone="accent">{stage.shortLabel}</Badge>
            <span className="text-[11px] text-faint">
              Step {stage.index + 1} of 10
            </span>
          </div>

          <div className="mt-auto pt-4">
            <ProgressBar value={project.progress} />
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-faint">
              <span className="flex items-center gap-3">
                <span>
                  <span className="text-muted">{project.conceptCount}</span> concepts
                </span>
                <span>
                  <span className="text-muted">{project.finalistCount}</span> finalists
                </span>
              </span>
              <span>{formatRelative(project.updatedAt)}</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Overflow menu, kept outside the Link so it does not navigate. */}
      <div className="absolute right-2.5 top-2.5">
        <IconButton
          label="Project actions"
          active={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="bg-void/60 backdrop-blur-sm"
        >
          <MoreHorizontal size={15} />
        </IconButton>

        {menuOpen ? (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <div className="absolute right-0 top-9 z-20 w-44 animate-rise overflow-hidden rounded-lg border border-line-strong bg-surface-2 py-1 shadow-panel">
              <MenuItem
                icon={<Copy size={13} />}
                label="Duplicate"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate(project.id);
                }}
              />
              <MenuItem
                icon={archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                label={archived ? "Restore" : "Archive"}
                onClick={() => {
                  setMenuOpen(false);
                  onArchive(project.id, !archived);
                }}
              />
              <div className="my-1 h-px bg-line" />
              <MenuItem
                icon={<Trash2 size={13} />}
                label="Delete"
                tone="danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(project.id);
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors",
        tone === "danger"
          ? "text-danger hover:bg-danger/10"
          : "text-muted hover:bg-white/5 hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
