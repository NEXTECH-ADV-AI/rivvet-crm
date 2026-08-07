import { Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW } from "@/lib/crm/seed";
import { queueOpps } from "@/lib/crm/filters";
import { formatMoney, oppPriority } from "@/lib/crm/priority";
import { isLoadEligible } from "@/lib/crm/sequence-queries";
import { VERTICAL_LABEL } from "@/lib/crm/lead-model";

/** Prefer load-eligible Instantly work over deal vanity */
export function AgentStrip() {
  const leads = useCrmStore((s) => s.leads);
  const opps = useCrmStore((s) => s.opportunities);

  const cue = useMemo(() => {
    const eligible = leads
      .filter(isLoadEligible)
      .sort((a, b) => {
        if (a.vertical === "hvac" && b.vertical !== "hvac") return 1;
        if (b.vertical === "hvac" && a.vertical !== "hvac") return -1;
        return b.icpScore - a.icpScore;
      });
    const topEligible = eligible[0];
    const oq = queueOpps(opps);
    const topOpp = oq[0];

    // Sequence path first if load-eligible exists
    if (topEligible) {
      return {
        kind: "lead" as const,
        label: "Load-eligible",
        text: topEligible.nextAction
          ? `${topEligible.nextAction} · ${topEligible.company}`
          : `Load to ${VERTICAL_LABEL[topEligible.vertical]} campaign · ${topEligible.company}`,
        meta: `${VERTICAL_LABEL[topEligible.vertical]} · ${topEligible.state ?? "—"} · ${eligible.length} ready`,
        leadId: topEligible.id,
      };
    }
    if (topOpp) {
      const p = oppPriority(topOpp, DEMO_NOW);
      return {
        kind: "opp" as const,
        label: "Next deal action",
        text: topOpp.nextAction
          ? `${topOpp.nextAction} · ${topOpp.name}`
          : `Set next step · ${topOpp.name}`,
        meta: `${p.priority} · ${formatMoney(topOpp.amount)}`,
        oppId: topOpp.id,
      };
    }
    return {
      kind: "none" as const,
      label: "Queue clear",
      text: "No load-eligible leads — open Needs enrich / verify",
      meta: "Sequences board",
    };
  }, [leads, opps]);

  return (
    <div className="flex items-center gap-3 border-b border-border-soft bg-agent-soft/70 px-4 py-2 sm:px-6 lg:px-8">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-agent/15 text-agent">
        <Sparkles className="size-3.5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="crm-label text-agent">{cue.label}</p>
        <p className="truncate text-sm font-medium text-ink">{cue.text}</p>
      </div>
      <span className="hidden font-mono text-[10px] text-fg-subtle sm:inline">
        {cue.meta}
      </span>
      {cue.kind === "lead" ? (
        <Link
          to="/leads/$leadId"
          params={{ leadId: cue.leadId! }}
          className="shrink-0 rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-deep-ink"
        >
          Open
        </Link>
      ) : cue.kind === "opp" ? (
        <Link
          to="/opportunities/$oppId"
          params={{ oppId: cue.oppId! }}
          className="shrink-0 rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-deep-ink"
        >
          Open
        </Link>
      ) : (
        <Link
          to="/sequences"
          className="shrink-0 rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-deep-ink"
        >
          Sequences
        </Link>
      )}
    </div>
  );
}
