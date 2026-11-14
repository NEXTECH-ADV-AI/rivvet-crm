import {
  daysUntil,
  formatMoney,
  oppPriority,
  STAGE_LABEL,
  KANBAN_STAGES,
  OWNER_LABEL,
} from "./priority";
import type { Account, Activity, Lead, LeadBookSnapshot, Opportunity } from "./types";
import {
  isInInstantly,
  isSequenceReady,
  isWorkableLead,
  needsEmailVerify,
  needsEnrich,
} from "./lead-model";

/** The hydrate message carries this tag when the live opportunities read failed,
 *  so pages can say "unavailable" instead of showing an empty pipeline (RIV-1940). */
export const OPPS_UNAVAILABLE_TAG = "opportunities unavailable";

export type PipelineState = "loading" | "unavailable" | "empty" | "ready";

/** What the pipeline numbers on Home and Analytics should say. Zero rows is
 *  "empty", a failed read is "unavailable"; neither is ever shown as $0. */
export function pipelineState(input: {
  opportunities: Opportunity[];
  hydratedAt: string | null;
  unavailable: boolean;
}): PipelineState {
  if (!input.hydratedAt) return "loading";
  if (input.unavailable) return "unavailable";
  return input.opportunities.length ? "ready" : "empty";
}

/** The three money KPIs on Analytics, exactly as rendered. Only a "ready"
 *  pipeline shows dollars; loading, unavailable and empty each show their own
 *  state, never a formatted $0 (RIV-1940). */
export function pipelineKpiDisplay(
  state: PipelineState,
  kpis: { pipeline: number; weighted: number; closing30Amt: number; closing30Count: number; unpriced?: number; openDeals?: number; closingUnpriced?: number },
): { pipeline: string; weighted: string; closing: string; closingSub: string | undefined } {
  if (state !== "ready") {
    const v = state === "loading" ? "\u2026" : state === "unavailable" ? "Unavailable" : "None yet";
    return { pipeline: v, weighted: v, closing: v, closingSub: undefined };
  }
  return {
    pipeline: kpis.unpriced && kpis.unpriced === kpis.openDeals ? "Not priced" : formatMoney(kpis.pipeline),
    weighted: kpis.unpriced && kpis.unpriced === kpis.openDeals ? "Not priced" : formatMoney(kpis.weighted),
    closing: kpis.closingUnpriced && kpis.closingUnpriced === kpis.closing30Count ? "Not priced" : formatMoney(kpis.closing30Amt),
    closingSub: `${kpis.closing30Count} ${kpis.closing30Count === 1 ? "opportunity" : "opportunities"}`,
  };
}

function openOpp(o: Opportunity) {
  return o.stage !== "closed_won" && o.stage !== "closed_lost";
}

export function buildGtmAnalytics(
  opportunities: Opportunity[],
  leads: Lead[],
  accounts: Account[],
  activities: Activity[],
  book?: LeadBookSnapshot | null,
  options: { period?: "30d" | "all"; now?: number } = {},
) {
  const now = options.now ?? Date.now();
  const inPeriod = (iso: string) => options.period !== "30d" || (Date.parse(iso) >= now - 30 * 86400000 && Date.parse(iso) <= now);
  const periodLeads = leads.filter((l) => inPeriod(l.createdAt));
  const open = opportunities.filter(openOpp);
  const won = opportunities.filter((o) => o.stage === "closed_won");
  const lost = opportunities.filter((o) => o.stage === "closed_lost");
  const pipeline = open.reduce((s, o) => s + o.amount, 0);
  const weighted = open.reduce(
    (s, o) => s + o.amount * (o.probability / 100),
    0,
  );
  const wonYtd = won.reduce((s, o) => s + o.amount, 0);
  const closing30 = open.filter(
    (o) => o.closeDate && daysUntil(o.closeDate, now) >= 0 && daysUntil(o.closeDate, now) <= 30,
  );
  const closing30Amt = closing30.reduce((s, o) => s + o.amount, 0);
  const p1Opps = open.filter((o) => oppPriority(o, now).priority === "P1");
  const missingNext = open.filter((o) => !o.nextAction).length;

  const sequenceReady = leads.filter(isSequenceReady);
  const readyNotLoaded = sequenceReady.filter((l) => !isInInstantly(l));
  const inInstantly = leads.filter(isInInstantly);
  const atRisk = accounts.filter(
    (a) => a.health === "risk" || a.status === "at_risk",
  );
  const openTasks = activities.filter((a) => !a.completedAt && a.dueAt);

  const byStage = KANBAN_STAGES.filter((s) => s !== "closed_lost" && s !== "closed_won").map(
    (stage) => {
      const items = open.filter((o) => o.stage === stage);
      return {
        stage,
        label: STAGE_LABEL[stage] ?? stage,
        count: items.length,
        amount: items.reduce((s, o) => s + o.amount, 0),
        unpriced: items.filter((o) => o.amountKnown === false).length,
      };
    },
  );

  const byOwnerMap = new Map<
    string,
    { ownerId: string; owner: string; amount: number; count: number }
  >();
  for (const o of open) {
    const cur = byOwnerMap.get(o.ownerId) ?? {
      ownerId: o.ownerId,
      owner: OWNER_LABEL[o.ownerId] ?? o.ownerId,
      amount: 0,
      count: 0,
    };
    cur.amount += o.amount;
    cur.count += 1;
    byOwnerMap.set(o.ownerId, cur);
  }
  const byOwner = [...byOwnerMap.values()].sort((a, b) => b.amount - a.amount);

  // Last six weeks from real opportunity dates (was a hardcoded series).
  const WEEK = 7 * 86400000;
  const weekIndex = (iso: string | null | undefined) => {
    const t = iso ? new Date(iso).getTime() : NaN;
    if (!Number.isFinite(t)) return -1;
    const ago = Math.floor((now - t) / WEEK);
    return ago >= 0 && ago < 6 ? 5 - ago : -1;
  };
  const weekly = ["W-5", "W-4", "W-3", "W-2", "W-1", "This"].map((week) => ({
    week,
    created: 0,
    won: 0,
    lost: 0,
  }));
  for (const o of opportunities) {
    const c = weekIndex(o.createdAt);
    if (c >= 0) weekly[c].created += 1;
    if (c >= 0 && o.stage === "closed_won") weekly[c].won += 1;
    if (c >= 0 && o.stage === "closed_lost") weekly[c].lost += 1;
  }

  const sourceCounts = new Map<string, number>();
  for (const lead of periodLeads) {
    const source = lead.source.toLowerCase();
    const label = /partner|referral/.test(source) ? "Partner"
      : source.includes("inbound") ? "Inbound"
      : source.includes("outbound") ? "Outbound"
      : /scrape|google_maps/.test(source) ? "Scrape" : "Other";
    sourceCounts.set(label, (sourceCounts.get(label) ?? 0) + 1);
  }
  const sourceMix = [...sourceCounts].map(([source, value]) => ({ source, value }));

  const closedTotal = won.length + lost.length;
  const winRate =
    closedTotal > 0 ? Math.round((won.length / closedTotal) * 100) : null;

  return {
    period: {
      created: opportunities.filter((o) => inPeriod(o.createdAt)).length,
      won: won.length,
      lost: lost.length,
      activities: activities.filter((a) => inPeriod(a.completedAt ?? a.createdAt)).length,
      leads: periodLeads.length,
    },
    kpis: {
      pipeline,
      weighted,
      wonYtd,
      closing30Amt,
      closing30Count: closing30.length,
      openDeals: open.length,
      unpriced: open.filter((o) => o.amountKnown === false).length,
      closingUnpriced: closing30.filter((o) => o.amountKnown === false).length,
      p1Count: p1Opps.length,
      missingNext,
      sequenceReady: sequenceReady.length,
      readyNotLoaded: readyNotLoaded.length,
      inInstantly: inInstantly.length,
      needsEnrich: leads.filter(needsEnrich).length,
      needsVerify: leads.filter(needsEmailVerify).length,
      workableLeads: leads.filter(isWorkableLead).length,
      bookTotal: book?.total ?? null,
      bookSequenceReady: book?.sequenceReady ?? null,
      bookValidEmail: book?.validEmail ?? null,
      bookInInstantly: book?.inInstantly ?? null,
      atRisk: atRisk.length,
      openTasks: openTasks.length,
      winRate,
      avgDeal: open.length ? Math.round(pipeline / open.length) : 0,
      hvacShare: book?.hvacSharePct ?? null,
    },
    byStage,
    byOwner,
    weekly,
    sourceMix,
    campaignLoads: book?.byCampaignLoads ?? {},
    topDeals: [...open]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        name: o.name,
        amount: o.amount,
        amountKnown: o.amountKnown,
        stage: STAGE_LABEL[o.stage] ?? o.stage,
        priority: oppPriority(o, now).priority,
        closeDate: o.closeDate,
      })),
  };
}

export { formatMoney };
