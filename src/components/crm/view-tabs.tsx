import type { ListView } from "@/lib/crm/types";
import { cn } from "@/components/ui/cn";

const DEFAULT_VIEWS: { id: ListView; label: string }[] = [
  { id: "my_open", label: "My open" },
  { id: "stale_7d", label: "Stale >7d" },
  { id: "closing_month", label: "Closing this month" },
  { id: "all", label: "All" },
];

/** Load-eligible first (ready not yet in Instantly) */
export const LEAD_VIEWS: { id: ListView; label: string }[] = [
  { id: "sequence_ready", label: "Load-eligible" },
  { id: "needs_enrich", label: "Needs enrich" },
  { id: "needs_verify", label: "Needs verify" },
  { id: "in_instantly", label: "In Instantly" },
  { id: "high_icp", label: "High ICP eligible" },
  { id: "stale_7d", label: "Stale eligible" },
  { id: "my_open", label: "My queue" },
  { id: "all", label: "Sample all" },
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
    <div className="flex flex-wrap gap-1 rounded-lg border border-border-soft bg-card-soft p-1">
      {views.map((v) => {
        const active = value === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-(--dur-fast)",
              active
                ? "bg-card text-ink shadow-soft"
                : "text-fg-muted hover:text-ink",
            )}
          >
            {v.label}
            {counts?.[v.id] != null && (
              <span className="ml-1.5 font-mono text-[10px] text-fg-subtle">
                {counts[v.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
