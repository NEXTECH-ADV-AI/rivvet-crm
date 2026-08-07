import { Search, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { LeadFilterState } from "@/lib/crm/filters";
import {
  ALL_VERTICALS,
  LIFECYCLE_LABEL,
  LIFECYCLE_ORDER,
  SEQUENCE_VERTICALS,
  TARGET_STATES,
  VERTICAL_LABEL,
  isSequenceVertical,
} from "@/lib/crm/lead-model";
import type {
  EmailVerificationStatus,
  LeadLifecycle,
  Vertical,
} from "@/lib/crm/types";

export function LeadFilters({
  value,
  onChange,
  resultCount,
}: {
  value: LeadFilterState;
  onChange: (next: LeadFilterState) => void;
  resultCount: number;
}) {
  const set = <K extends keyof LeadFilterState>(
    k: K,
    v: LeadFilterState[K],
  ) => onChange({ ...value, [k]: v });

  const dirty =
    value.query ||
    value.priority !== "all" ||
    value.owner !== "all" ||
    value.vertical !== "all" ||
    value.lifecycle !== "all" ||
    value.minIcp > 0 ||
    value.enrichment !== "all" ||
    value.verified !== "all" ||
    value.emailVerify !== "all" ||
    value.sequenceOnly ||
    value.state !== "all";

  return (
    <div className="space-y-2 rounded-xl border border-border-soft bg-card p-2.5 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            value={value.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Search name, company, state, campaign…"
            className="w-full rounded-md border border-border-soft bg-mist/60 py-2 pl-8 pr-8 text-sm focus:border-signal-cyan focus:bg-card focus:outline-none"
          />
          {value.query && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle"
              onClick={() => set("query", "")}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <span className="font-mono text-[11px] tabular text-fg-subtle">
          {resultCount} shown
        </span>
        {dirty && (
          <button
            type="button"
            className="text-[11px] font-medium text-product-mint hover:underline"
            onClick={() =>
              onChange({
                query: "",
                priority: "all",
                owner: "all",
                vertical: "all",
                lifecycle: "all",
                minIcp: 0,
                enrichment: "all",
                verified: "all",
                emailVerify: "all",
                sequenceOnly: false,
                state: "all",
              })
            }
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Select
          label="Vertical"
          value={value.vertical}
          onChange={(v) => set("vertical", v as Vertical | "all")}
          options={[
            { value: "all", label: "All verticals" },
            ...SEQUENCE_VERTICALS.map((v) => ({
              value: v,
              label: `${VERTICAL_LABEL[v]} ★`,
            })),
            ...ALL_VERTICALS.filter((v) => !isSequenceVertical(v)).map((v) => ({
              value: v,
              label: VERTICAL_LABEL[v],
            })),
          ]}
        />
        <Select
          label="State"
          value={value.state}
          onChange={(v) => set("state", v)}
          options={[
            { value: "all", label: "All states" },
            ...TARGET_STATES.map((s) => ({ value: s, label: s })),
          ]}
        />
        <Select
          label="Email verify"
          value={value.emailVerify}
          onChange={(v) =>
            set("emailVerify", v as EmailVerificationStatus | "all")
          }
          options={[
            { value: "all", label: "Email: any" },
            { value: "valid", label: "Valid email" },
            { value: "pending", label: "Verify pending" },
            { value: "invalid", label: "Invalid" },
            { value: "risky", label: "Risky" },
          ]}
        />
        <Select
          label="Stage"
          value={value.lifecycle}
          onChange={(v) => set("lifecycle", v as LeadLifecycle | "all")}
          options={[
            { value: "all", label: "All stages" },
            ...LIFECYCLE_ORDER.map((s) => ({
              value: s,
              label: LIFECYCLE_LABEL[s],
            })),
          ]}
        />
        <Select
          label="Enrichment"
          value={value.enrichment}
          onChange={(v) =>
            set("enrichment", v as LeadFilterState["enrichment"])
          }
          options={[
            { value: "all", label: "Any enrichment" },
            { value: "none", label: "Not enriched" },
            { value: "partial", label: "Partial" },
            { value: "complete", label: "Complete" },
          ]}
        />
        <Select
          label="Owner"
          value={value.owner}
          onChange={(v) => set("owner", v)}
          options={[
            { value: "all", label: "All owners" },
            { value: "usr_you", label: "You" },
            { value: "usr_maya", label: "Maya" },
            { value: "usr_jordan", label: "Jordan" },
            { value: "unassigned", label: "Unassigned" },
          ]}
        />
        <button
          type="button"
          onClick={() => set("sequenceOnly", !value.sequenceOnly)}
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-[11px] font-semibold",
            value.sequenceOnly
              ? "border-product-mint/40 bg-product-mint/10 text-product-mint"
              : "border-border-soft bg-mist/50 text-fg-muted hover:text-ink",
          )}
        >
          Sequence-ready only
        </button>
        <div className="flex rounded-md border border-border-soft bg-mist/50 p-0.5">
          {(["all", "P1", "P2", "P3"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => set("priority", p)}
              className={cn(
                "rounded px-2 py-1 font-mono text-[11px] font-semibold",
                value.priority === p
                  ? p === "P1"
                    ? "bg-p1 text-white"
                    : p === "P2"
                      ? "bg-warn text-white"
                      : "bg-card text-ink shadow-soft"
                  : "text-fg-muted",
              )}
            >
              {p === "all" ? "All P" : p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border-soft bg-mist/60 px-2 py-1.5 text-[11px] text-ink focus:border-signal-cyan focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
