import { Search, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { PRIORITY_LABEL } from "./priority-badge";
import type { Priority } from "@/lib/crm/types";

export type PriorityFilter = Priority | "all";
export type OwnerFilter = "all" | "usr_you" | "usr_maya" | "usr_jordan";

const PRIORITIES: { id: PriorityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "P1", label: PRIORITY_LABEL.P1 },
  { id: "P2", label: PRIORITY_LABEL.P2 },
  { id: "P3", label: PRIORITY_LABEL.P3 },
];

const OWNERS: { id: OwnerFilter; label: string }[] = [
  { id: "all", label: "All owners" },
  { id: "usr_you", label: "You" },
  { id: "usr_maya", label: "Maya" },
  { id: "usr_jordan", label: "Jordan" },
];

export function FilterBar({
  query,
  onQuery,
  priority,
  onPriority,
  owner,
  onOwner,
  resultCount,
  className,
}: {
  query: string;
  onQuery: (q: string) => void;
  priority: PriorityFilter;
  onPriority: (p: PriorityFilter) => void;
  owner?: OwnerFilter;
  onOwner?: (o: OwnerFilter) => void;
  resultCount?: number;
  className?: string;
}) {
  const hasFilters =
    query.trim() !== "" || priority !== "all" || (owner && owner !== "all");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:gap-4",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
        <input
          aria-label="Filter this view"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter this view…"
          className="crm-control w-full pl-9 pr-12 placeholder:text-fg-subtle"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery("")}
            className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-sm text-fg-subtle hover:text-ink"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex flex-wrap rounded-sm border border-border bg-mist p-0.5">
          {PRIORITIES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={priority === p.id}
              onClick={() => onPriority(p.id)}
              className={cn(
                "crm-button transition-colors",
                priority === p.id
                  ? p.id === "P1"
                    ? "bg-p1 text-white"
                    : p.id === "P2"
                      ? "bg-warn text-white"
                      : "bg-card text-ink shadow-soft"
                  : "text-fg-muted hover:text-ink",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {onOwner && owner && (
          <select
            aria-label="Owner"
            value={owner}
            onChange={(e) => onOwner(e.target.value as OwnerFilter)}
            className="crm-control"
          >
            {OWNERS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}

        {resultCount != null && (
          <span className="ml-auto font-mono text-[11px] tabular text-fg-subtle sm:ml-0">
            {resultCount} shown
          </span>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              onQuery("");
              onPriority("all");
              onOwner?.("all");
            }}
            className="crm-button text-product-mint hover:underline"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
