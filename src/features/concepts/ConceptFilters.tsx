"use client";

import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/Button";
import type { ConceptStatus, CreativeDirection } from "@/types";
import { CONCEPT_STATUSES } from "@/types";
import type { ConceptFilter, SortKey } from "@/workflows/mutations";
import { cn } from "@/utils/cn";

export function ConceptFilters({
  filter,
  onChange,
  directions,
  sort,
  onSortChange,
  counts,
}: {
  filter: ConceptFilter;
  onChange: (filter: ConceptFilter) => void;
  directions: CreativeDirection[];
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  counts: Record<ConceptStatus, number>;
}) {
  const toggleStatus = (status: ConceptStatus) =>
    onChange({
      ...filter,
      statuses: filter.statuses.includes(status)
        ? filter.statuses.filter((s) => s !== status)
        : [...filter.statuses, status],
    });

  const toggleDirection = (id: string) =>
    onChange({
      ...filter,
      directionIds: filter.directionIds.includes(id)
        ? filter.directionIds.filter((d) => d !== id)
        : [...filter.directionIds, id],
    });

  const active =
    filter.query ||
    filter.statuses.length ||
    filter.directionIds.length ||
    filter.minRating > 0 ||
    filter.iterationsOnly ||
    filter.originalsOnly;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <Input
            value={filter.query}
            onChange={(e) => onChange({ ...filter, query: e.target.value })}
            placeholder="Search names, notes, rationale, concept codes…"
            className="pl-8"
          />
        </div>

        <Select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="w-auto"
          aria-label="Sort concepts"
        >
          <option value="code">By code</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="rating">Highest rated</option>
        </Select>

        <Select
          value={String(filter.minRating)}
          onChange={(e) => onChange({ ...filter, minRating: Number(e.target.value) })}
          className="w-auto"
          aria-label="Minimum rating"
        >
          <option value="0">Any rating</option>
          <option value="3">3+ stars</option>
          <option value="4">4+ stars</option>
          <option value="5">5 stars</option>
        </Select>

        {active ? (
          <IconButton
            label="Clear filters"
            onClick={() =>
              onChange({
                query: "",
                statuses: [],
                directionIds: [],
                minRating: 0,
                iterationsOnly: false,
                originalsOnly: false,
              })
            }
          >
            <X size={15} />
          </IconButton>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {CONCEPT_STATUSES.filter((s) => counts[s] > 0 || filter.statuses.includes(s)).map(
          (status) => (
            <Chip
              key={status}
              active={filter.statuses.includes(status)}
              onClick={() => toggleStatus(status)}
            >
              {status}
              <span className="ml-1 text-faint">{counts[status] ?? 0}</span>
            </Chip>
          ),
        )}

        <span className="mx-1 h-4 w-px bg-line" />

        <Chip
          active={filter.originalsOnly}
          onClick={() =>
            onChange({
              ...filter,
              originalsOnly: !filter.originalsOnly,
              iterationsOnly: false,
            })
          }
        >
          Originals
        </Chip>
        <Chip
          active={filter.iterationsOnly}
          onClick={() =>
            onChange({
              ...filter,
              iterationsOnly: !filter.iterationsOnly,
              originalsOnly: false,
            })
          }
        >
          Iterations
        </Chip>

        {directions.length > 1 ? (
          <>
            <span className="mx-1 h-4 w-px bg-line" />
            {directions.map((d) => (
              <Chip
                key={d.id}
                active={filter.directionIds.includes(d.id)}
                onClick={() => toggleDirection(d.id)}
                title={d.name}
              >
                {d.number}. {d.name}
              </Chip>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "max-w-[180px] truncate rounded-md border px-2 py-1 text-[11px] capitalize transition-colors",
        active
          ? "border-accent/50 bg-accent/12 text-accent"
          : "border-line bg-surface-2 text-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
