import { Search, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { PRIORITY_LABEL } from "./priority-badge";
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
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            aria-label="Search leads"
            value={value.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Search name, company, state, campaign…"
            className="crm-control w-full pl-9 pr-12 placeholder:text-fg-subtle"
          />
          {value.query && (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-sm text-fg-subtle"
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
            className="crm-button text-product-mint hover:underline"
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

      <div className="flex flex-wrap items-center gap-2">
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
          label="Details"
          value={value.enrichment}
          onChange={(v) =>
            set("enrichment", v as LeadFilterState["enrichment"])
          }
          options={[
            { value: "all", label: "Any details" },
            { value: "none", label: "No details yet" },
            { value: "partial", label: "Partial" },
            { value: "complete", label: "Complete" },
          ]}
        />
        <button
          type="button"
          aria-pressed={value.sequenceOnly}
          onClick={() => set("sequenceOnly", !value.sequenceOnly)}
          className={cn(
            "crm-button border",
            value.sequenceOnly
              ? "border-product-mint/40 bg-product-mint/10 text-product-mint"
              : "border-border bg-card text-fg-muted hover:text-ink",
          )}
        >
          Ready for email only
        </button>
        <div className="flex flex-wrap rounded-sm border border-border bg-mist p-0.5">
          {(["all", "P1", "P2", "P3"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={value.priority === p}
              onClick={() => set("priority", p)}
              className={cn(
                "crm-button",
                value.priority === p
                  ? p === "P1"
                    ? "bg-p1 text-white"
                    : p === "P2"
                      ? "bg-warn text-white"
                      : "bg-card text-ink shadow-soft"
                  : "text-fg-muted",
              )}
            >
              {p === "all" ? "All" : PRIORITY_LABEL[p]}
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
    <label className="min-w-0 max-w-full">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="crm-control"
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
