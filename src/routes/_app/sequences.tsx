import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Mail, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/crm/page-header";
import { useCrmStore } from "@/lib/crm/store";
import {
  LOAD_GO_CHECKLIST,
  campaignReadiness,
  isLoadEligible,
  DEFAULT_GO_BATCH_SIZE,
} from "@/lib/crm/sequence-queries";
import {
  VERTICAL_LABEL,
  type SequenceVertical,
} from "@/lib/crm/lead-model";
import { leadBookSnapshot } from "@/lib/crm/seed";
import { cn } from "@/components/ui/cn";

export const Route = createFileRoute("/_app/sequences")({
  component: SequencesPage,
});

function SequencesPage() {
  const leads = useCrmStore((s) => s.leads);
  const lastLoadGo = useCrmStore((s) => s.lastLoadGo);
  const simulateLoadGo = useCrmStore((s) => s.simulateLoadGo);

  const readiness = useMemo(() => campaignReadiness(leads), [leads]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [selected, setSelected] = useState<SequenceVertical | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const allChecked = LOAD_GO_CHECKLIST.every((_, i) => checked[i]);
  const selectedMeta = readiness.find((r) => r.vertical === selected);

  const eligibleCount = leads.filter(isLoadEligible).length;
  const book = leadBookSnapshot;

  function toggle(i: number) {
    setChecked((c) => ({ ...c, [i]: !c[i] }));
  }

  function runGo() {
    if (!selected || !allChecked) return;
    const r = simulateLoadGo(selected, DEFAULT_GO_BATCH_SIZE);
    setResult(r.message);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Instantly · Load GO"
        title="Sequences"
        description="Campaign readiness + mandatory checklist. Sandbox simulates load only — production loader stays off until real GO."
        action={
          <Link
            to="/leads"
            className="rounded-md border border-border-soft bg-card px-3 py-2 text-xs font-semibold shadow-soft hover:bg-mist"
          >
            Load-eligible queue
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Sample load-eligible" value={eligibleCount} accent />
        <Stat label="Book sequence-ready" value={book.sequenceReady} />
        <Stat label="Book in Instantly" value={book.inInstantly} />
        <Stat
          label="Idle prod camps"
          value={Object.values(book.byCampaignLoads).filter((n) => !n).length}
          warn
        />
      </div>

      <div className="mb-4 rounded-xl border border-warn/30 bg-warn/5 px-3 py-2.5 text-[12px] text-fg-muted">
        <p className="flex items-start gap-2 font-medium text-ink">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />
          <span>
            HVAC Nat'l is kill_candidate (0 replies on sends). Pilot a{" "}
            <strong>non-HVAC</strong> vertical ≤50. Equal vertical scrape volume
            is wrong — fill load-eligible deficits only.
          </span>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="crm-surface p-4 lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Campaign readiness (sample + prod notes)
          </h2>
          <ul className="space-y-2">
            {readiness.map((r) => {
              const active = selected === r.vertical;
              return (
                <li key={r.vertical}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(r.vertical);
                      setResult(null);
                    }}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition sm:flex-row sm:items-center sm:justify-between",
                      active
                        ? "border-signal-cyan bg-agent-soft"
                        : "border-border-soft bg-mist/40 hover:bg-mist",
                      r.status === "kill_candidate" && !active && "opacity-90",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {r.campaignName}
                        </span>
                        <Status status={r.status} />
                        <span className="text-[11px] text-fg-subtle">
                          {VERTICAL_LABEL[r.vertical]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-fg-muted">
                        {r.notes}
                      </p>
                    </div>
                    <div className="flex gap-3 font-mono text-[11px] tabular">
                      <span>
                        <span className="text-fg-subtle">eligible </span>
                        <span className="font-semibold text-product-mint">
                          {r.loadEligible}
                        </span>
                      </span>
                      <span>
                        <span className="text-fg-subtle">loaded </span>
                        <span className="font-semibold text-ink">
                          {r.inCampaign}
                        </span>
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="crm-surface p-4 lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-ink">
            Load GO checklist
          </h2>
          <p className="mb-3 text-[11px] text-fg-subtle">
            All items required before simulate. Production: n8n loader only.
          </p>
          <ul className="mb-4 space-y-1.5">
            {LOAD_GO_CHECKLIST.map((item, i) => (
              <li key={item}>
                <label className="flex cursor-pointer items-start gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={Boolean(checked[i])}
                    onChange={() => toggle(i)}
                    className="mt-0.5"
                  />
                  <span className={checked[i] ? "text-ink" : "text-fg-muted"}>
                    {item}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-border-soft bg-mist/50 px-3 py-2 text-[11px]">
            <p className="text-fg-subtle">Selected</p>
            <p className="font-semibold text-ink">
              {selectedMeta
                ? `${selectedMeta.campaignName} · ${selectedMeta.loadEligible} eligible`
                : "Pick a campaign"}
            </p>
            {selected === "hvac" && (
              <p className="mt-1 text-warn">
                HVAC blocked in sandbox until RCA — choose Pool / Plumbing /
                etc.
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!selected || !allChecked || selected === "hvac"}
            onClick={runGo}
            className={cn(
              "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5 text-xs font-semibold",
              selected && allChecked && selected !== "hvac"
                ? "bg-ink text-white hover:bg-deep-ink"
                : "cursor-not-allowed bg-mist text-fg-subtle",
            )}
          >
            <Mail className="size-3.5" />
            Simulate Load GO (max {DEFAULT_GO_BATCH_SIZE})
          </button>

          {result && (
            <p
              className={cn(
                "mt-2 flex items-start gap-1.5 text-[12px] font-medium",
                result.startsWith("Loaded")
                  ? "text-product-mint"
                  : "text-warn",
              )}
            >
              {result.startsWith("Loaded") && (
                <Check className="mt-0.5 size-3.5 shrink-0" />
              )}
              {result}
            </p>
          )}

          {lastLoadGo && (
            <p className="mt-2 font-mono text-[10px] text-fg-subtle">
              Last GO: {lastLoadGo.count} {lastLoadGo.vertical} @{" "}
              {lastLoadGo.at.slice(0, 16)}
            </p>
          )}
        </section>
      </div>

      <section className="mt-4 crm-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">
          Kill / scale rules (from plan)
        </h2>
        <ul className="grid gap-2 text-[12px] text-fg-muted sm:grid-cols-2">
          <li className="rounded-md border border-border-soft bg-mist/40 px-3 py-2">
            Bounce over 2% → pause campaign, RCA before reload
          </li>
          <li className="rounded-md border border-border-soft bg-mist/40 px-3 py-2">
            200+ sends with 0 replies → pause (HVAC Nat'l status)
          </li>
          <li className="rounded-md border border-border-soft bg-mist/40 px-3 py-2">
            Healthy reply + invalid under 1% → may scale batch carefully
          </li>
          <li className="rounded-md border border-border-soft bg-mist/40 px-3 py-2">
            Zero load-eligible for 14d → fix enrich/verify for that vertical
          </li>
        </ul>
      </section>
    </div>
  );
}

function Status({
  status,
}: {
  status: "active" | "idle" | "kill_candidate";
}) {
  const map = {
    active: "bg-product-mint/15 text-product-mint",
    idle: "bg-warn/15 text-warn",
    kill_candidate: "bg-danger/15 text-danger",
  };
  const label = {
    active: "active",
    idle: "idle",
    kill_candidate: "kill / RCA",
  };
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
        map[status],
      )}
    >
      {label[status]}
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="crm-surface px-3 py-2.5">
      <p className="crm-label">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-xl font-semibold tabular",
          warn ? "text-warn" : accent ? "text-product-mint" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
