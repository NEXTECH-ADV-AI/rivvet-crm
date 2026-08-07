import { DEMO_NOW, leadBookSnapshot } from "./seed";
import {
  daysUntil,
  formatMoney,
  oppPriority,
  STAGE_LABEL,
  KANBAN_STAGES,
  OWNER_LABEL,
} from "./priority";
import type { Account, Activity, Lead, Opportunity } from "./types";
import {
  isInInstantly,
  isSequenceReady,
  isWorkableLead,
  needsEmailVerify,
  needsEnrich,
} from "./lead-model";

function openOpp(o: Opportunity) {
  return o.stage !== "closed_won" && o.stage !== "closed_lost";
}

export function buildGtmAnalytics(
  opportunities: Opportunity[],
  leads: Lead[],
  accounts: Account[],
  activities: Activity[],
) {
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
    (o) => o.closeDate && daysUntil(o.closeDate, DEMO_NOW) <= 30,
  );
  const closing30Amt = closing30.reduce((s, o) => s + o.amount, 0);
  const p1Opps = open.filter((o) => oppPriority(o, DEMO_NOW).priority === "P1");
  const missingNext = open.filter((o) => !o.nextAction).length;

  const sequenceReady = leads.filter(isSequenceReady);
  const readyNotLoaded = sequenceReady.filter((l) => !isInInstantly(l));
  const inInstantly = leads.filter(isInInstantly);
  const atRisk = accounts.filter(
    (a) => a.health === "risk" || a.status === "at_risk",
  );
  const openTasks = activities.filter((a) => !a.completedAt && a.dueAt);

  const byStage = KANBAN_STAGES.filter((s) => s !== "closed_lost").map(
    (stage) => {
      const items =
        stage === "closed_won" ? won : open.filter((o) => o.stage === stage);
      return {
        stage,
        label: STAGE_LABEL[stage] ?? stage,
        count: items.length,
        amount: items.reduce((s, o) => s + o.amount, 0),
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

  const weekly = [
    { week: "W-5", created: 3, won: 1, lost: 0 },
    { week: "W-4", created: 4, won: 0, lost: 1 },
    { week: "W-3", created: 2, won: 1, lost: 0 },
    { week: "W-2", created: 5, won: 1, lost: 1 },
    { week: "W-1", created: 3, won: 0, lost: 0 },
    { week: "This", created: 2, won: 0, lost: 0 },
  ];

  const sourceMix = [
    {
      source: "Inbound",
      value: leads.filter((l) =>
        l.source.toLowerCase().includes("inbound"),
      ).length,
    },
    {
      source: "Outbound",
      value: leads.filter((l) => l.source.toLowerCase().includes("outbound"))
        .length,
    },
    {
      source: "Scrape",
      value: leads.filter(
        (l) =>
          l.source.toLowerCase().includes("scrape") ||
          l.source.toLowerCase().includes("google_maps"),
      ).length,
    },
    {
      source: "Partner",
      value: leads.filter(
        (l) =>
          l.source.toLowerCase().includes("partner") ||
          l.source.toLowerCase().includes("referral"),
      ).length,
    },
  ].filter((s) => s.value > 0);

  const closedTotal = won.length + lost.length;
  const winRate =
    closedTotal > 0 ? Math.round((won.length / closedTotal) * 100) : 100;

  const book = leadBookSnapshot;

  return {
    kpis: {
      pipeline,
      weighted,
      wonYtd,
      closing30Amt,
      closing30Count: closing30.length,
      openDeals: open.length,
      p1Count: p1Opps.length,
      missingNext,
      sequenceReady: sequenceReady.length,
      readyNotLoaded: readyNotLoaded.length,
      inInstantly: inInstantly.length,
      needsEnrich: leads.filter(needsEnrich).length,
      needsVerify: leads.filter(needsEmailVerify).length,
      workableLeads: leads.filter(isWorkableLead).length,
      bookTotal: book.total,
      bookSequenceReady: book.sequenceReady,
      bookValidEmail: book.validEmail,
      bookInInstantly: book.inInstantly,
      atRisk: atRisk.length,
      openTasks: openTasks.length,
      winRate,
      avgDeal: open.length ? Math.round(pipeline / open.length) : 0,
      hvacShare: book.hvacSharePct,
    },
    byStage,
    byOwner,
    weekly,
    sourceMix,
    campaignLoads: book.byCampaignLoads,
    topDeals: [...open]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        name: o.name,
        amount: o.amount,
        stage: STAGE_LABEL[o.stage] ?? o.stage,
        priority: oppPriority(o, DEMO_NOW).priority,
        closeDate: o.closeDate,
      })),
  };
}

export { formatMoney };
