import type { ListView } from "@/lib/crm/types";
import { cn } from "@/components/ui/cn";

// Opportunities. No "My open": opportunities have no owners yet (founder, 2026-10-01).
const DEFAULT_VIEWS: { id: ListView; label: string }[] = [
  { id: "all", label: "All" },
  { id: "stale_7d", label: "No touch in 7 days" },
  { id: "closing_month", label: "Closing this month" },
];

// ponytail: no "My queue" until owners are real people (identity slice).
export const LEAD_VIEWS: { id: ListView; label: string }[] = [
  { id: "call_queue", label: "Call queue" },
  { id: "sequence_ready", label: "Ready for email" },
  { id: "in_instantly", label: "In a campaign" },
  { id: "high_icp", label: "Best fit" },
  { id: "needs_enrich", label: "Missing details" },
  { id: "needs_verify", label: "Email not checked" },
  { id: "stale_7d", label: "No touch in 7 days" },
  { id: "all", label: "All leads" },
];

export function ViewTabs({
  value,
  onChange,
  counts,
  views = DEFAULT_VIEWS,
}: {
  value: ListView;
  onChange: (v: ListView) => void;
  counts?: Partial<Record<ListView, number>>;
  views?: { id: ListView; label: string }[];
}) {
  return (
    <div tabIndex={0} role="region" aria-label="Saved views, scroll for more" className="crm-scroll flex gap-4 border-b border-border pb-px">
      {views.map((v) => {
        const active = value === v.id;
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(v.id)}
            className={cn(
              "min-h-11 shrink-0 border-b-2 px-1 py-2.5 text-sm font-semibold transition-colors duration-(--dur-fast)",
              active
                ? "border-ink text-ink"
                : "border-transparent text-fg-muted hover:text-ink",
            )}
          >
            {v.label}
            {counts?.[v.id] != null && (
              <span className="ml-1.5 font-mono text-xs text-fg-subtle">
                {counts[v.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
