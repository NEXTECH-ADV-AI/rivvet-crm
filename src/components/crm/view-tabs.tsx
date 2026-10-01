import type { ListView } from "@/lib/crm/types";
import { cn } from "@/components/ui/cn";

const DEFAULT_VIEWS: { id: ListView; label: string }[] = [
  { id: "my_open", label: "My open" },
  { id: "stale_7d", label: "Stale >7d" },
  { id: "closing_month", label: "Closing this month" },
  { id: "all", label: "All" },
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
