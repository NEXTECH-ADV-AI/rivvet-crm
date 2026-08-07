import { leadBookSnapshot } from "@/lib/crm/seed";
import {
  LIFECYCLE_LABEL,
  LIFECYCLE_ORDER,
  VERTICAL_LABEL,
  LEAD_OPS_PLAYBOOK,
  isSequenceVertical,
} from "@/lib/crm/lead-model";
import { formatPct } from "@/lib/crm/priority";
import type { LeadBookSnapshot, LeadLifecycle, Vertical } from "@/lib/crm/types";
import { cn } from "@/components/ui/cn";

export function LeadBookFunnel({
  book: bookProp,
  onLifecycle,
  onVertical,
  activeLifecycle,
  activeVertical,
}: {
  book?: LeadBookSnapshot;
  onLifecycle?: (s: LeadLifecycle | "all") => void;
  onVertical?: (v: Vertical | "all") => void;
  activeLifecycle?: LeadLifecycle | "all";
  activeVertical?: Vertical | "all";
}) {
  const s = bookProp ?? leadBookSnapshot;
  const hvacPct = s.hvacSharePct;
  const validRate = s.total > 0 ? (s.validEmail / s.total) * 100 : 0;
  const readyRate = s.total > 0 ? (s.sequenceReady / s.total) * 100 : 0;
  const loadRate =
    s.sequenceReady > 0 ? (s.inInstantly / s.sequenceReady) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Stat
          label="Book size"
          value={s.total.toLocaleString()}
          sub="scrapes ≠ pipeline"
        />
        <Stat
          label="Valid email"
          value={s.validEmail.toLocaleString()}
          sub={`${formatPct(validRate)} of book`}
        />
        <Stat
          label="Sequence-ready"
          value={s.sequenceReady.toLocaleString()}
          sub={`${formatPct(readyRate)} · north star`}
          accent
        />
        <Stat
          label="In Instantly"
          value={s.inInstantly.toLocaleString()}
          sub={`${formatPct(loadRate)} of ready`}
        />
        <Stat
          label="HVAC share"
          value={`${hvacPct}%`}
          sub={hvacPct > 40 ? "Rebalance loads" : "OK mix"}
          warn={hvacPct > 40}
        />
        <Stat
          label="States in loads"
          value={String(s.statesInLoads)}
          sub="geo breadth"
        />
        <Stat
          label="Idle campaigns"
          value={String(
            Object.values(s.byCampaignLoads).filter((n) => (n ?? 0) === 0)
              .length,
          )}
          sub="of 6 vertical camps"
          warn
        />
      </div>

      <div className="crm-surface p-3 sm:p-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">
            Instantly load mix (multi-vertical)
          </h2>
          <span className="text-[11px] text-fg-subtle">
            as of {s.asOf}
          </span>
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(s.byCampaignLoads).map(([name, n]) => {
            const count = n ?? 0;
            const isHvac = name.toLowerCase().includes("hvac");
            return (
              <li
                key={name}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2",
                  count === 0
                    ? "border-warn/30 bg-warn/5"
                    : isHvac
                      ? "border-border-soft bg-mist/40"
                      : "border-product-mint/25 bg-product-mint/5",
                )}
              >
                <span className="text-xs font-medium text-ink">{name}</span>
                <span className="font-mono text-sm font-semibold tabular">
                  {count}
                  {count === 0 && (
                    <span className="ml-1 text-[10px] font-sans text-warn">
                      idle
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="crm-surface p-3 sm:p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Lifecycle funnel</h2>
          <span className="text-[11px] text-fg-subtle">Filter sample</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {LIFECYCLE_ORDER.map((stage, i) => {
            const n = s.byLifecycle[stage] ?? 0;
            const pct = s.total > 0 ? (n / s.total) * 100 : 0;
            const active = activeLifecycle === stage;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => onLifecycle?.(active ? "all" : stage)}
                className={cn(
                  "min-w-[88px] flex-1 rounded-lg border px-2 py-2 text-left transition",
                  active
                    ? "border-signal-cyan bg-agent-soft"
                    : "border-border-soft bg-mist/40 hover:bg-mist",
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
                  {i + 1}. {LIFECYCLE_LABEL[stage] ?? stage}
                </p>
                <p className="mt-1 font-mono text-sm font-semibold tabular text-ink">
                  {n.toLocaleString()}
                </p>
                <p className="font-mono text-[10px] text-fg-subtle">
                  {formatPct(pct)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="crm-surface p-3 lg:col-span-3">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Vertical mix — scrapes vs sequence campaigns
          </h2>
          <ul className="space-y-1.5">
            {(Object.entries(s.byVertical) as [Vertical, number][])
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
              .map(([v, n]) => {
                const count = n ?? 0;
                const pct = s.total > 0 ? (count / s.total) * 100 : 0;
                const active = activeVertical === v;
                const isSeq = isSequenceVertical(v);
                return (
                  <li key={v}>
                    <button
                      type="button"
                      onClick={() => onVertical?.(active ? "all" : v)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left",
                        active && "bg-agent-soft",
                      )}
                    >
                      <span className="w-28 shrink-0 text-xs text-fg-muted">
                        {VERTICAL_LABEL[v] ?? v}
                        {isSeq && (
                          <span className="ml-1 text-[9px] text-product-mint">
                            camp
                          </span>
                        )}
                      </span>
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-mist">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            v === "hvac" ? "bg-warn" : "bg-product-mint",
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="w-16 text-right font-mono text-[11px] tabular text-ink">
                        {count.toLocaleString()}
                      </span>
                      <span className="w-12 text-right font-mono text-[10px] text-fg-subtle">
                        {formatPct(pct, 0)}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>

        <div className="crm-surface p-3 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Operating rules
          </h2>
          <p className="mb-2 text-[11px] text-fg-subtle">{s.notes}</p>
          <ul className="space-y-2">
            {LEAD_OPS_PLAYBOOK.map((item) => (
              <li key={item.title} className="text-[12px] leading-snug">
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-fg-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="crm-surface px-3 py-2.5">
      <p className="crm-label">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-lg font-semibold tabular",
          warn ? "text-warn" : accent ? "text-product-mint" : "text-ink",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-fg-subtle">{sub}</p>}
    </div>
  );
}
