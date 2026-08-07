import { Search, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { Priority } from "@/lib/crm/types";

export type PriorityFilter = Priority | "all";
export type OwnerFilter = "all" | "usr_you" | "usr_maya" | "usr_jordan";

const PRIORITIES: { id: PriorityFilter; label: string }[] = [
  { id: "all", label: "All P" },
  { id: "P1", label: "P1" },
  { id: "P2", label: "P2" },
  { id: "P3", label: "P3" },
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
        "flex flex-col gap-2 rounded-xl border border-border-soft bg-card p-2 shadow-soft sm:flex-row sm:items-center sm:gap-3 sm:p-2.5",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter this view…"
          className="w-full rounded-md border border-border-soft bg-mist/60 py-2 pl-8 pr-8 text-sm text-ink placeholder:text-fg-subtle focus:border-signal-cyan focus:bg-card focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-subtle hover:text-ink"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex rounded-md border border-border-soft bg-mist/50 p-0.5">
          {PRIORITIES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPriority(p.id)}
              className={cn(
                "rounded px-2 py-1 font-mono text-[11px] font-semibold transition-colors",
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
            value={owner}
            onChange={(e) => onOwner(e.target.value as OwnerFilter)}
            className="rounded-md border border-border-soft bg-mist/60 px-2 py-1.5 text-xs text-ink focus:border-signal-cyan focus:outline-none"
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
            className="text-[11px] font-medium text-product-mint hover:underline"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
