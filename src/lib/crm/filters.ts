import { DEMO_NOW } from "./seed";
import {
  daysSince,
  daysUntil,
  leadPriority,
  accountPriority,
  oppPriority,
  priorityRank,
} from "./priority";
import type {
  Account,
  Lead,
  LeadLifecycle,
  ListView,
  Opportunity,
  Priority,
  Vertical,
  EmailVerificationStatus,
} from "./types";
import {
  isInInstantly,
  isSequenceReady,
  isWorkableLead,
  needsEmailVerify,
  needsEnrich,
} from "./lead-model";

export function isOpenLead(l: Lead) {
  return (
    l.lifecycle !== "disqualified" &&
    l.lifecycle !== "closed_lost" &&
    l.lifecycle !== "closed_won"
  );
}

export function isOpenOpp(o: Opportunity) {
  return o.stage !== "closed_won" && o.stage !== "closed_lost";
}

export function filterLeads(items: Lead[], view: ListView): Lead[] {
  let list = [...items];

  if (view === "sequence_ready" || view === "ready") {
    // Default: can enter Instantly, not yet loaded (load GO queue)
    list = list.filter((l) => isSequenceReady(l) && !isInInstantly(l));
  }
  if (view === "needs_enrich" || view === "enrich_backlog") {
    list = list.filter(needsEnrich);
  }
  if (view === "needs_verify" || view === "unverified") {
    list = list.filter(
      (l) => needsEmailVerify(l) || (!l.ownerVerified && l.enrichmentStatus !== "none"),
    );
  }
  if (view === "in_instantly") {
    list = list.filter(isInInstantly);
  }
  if (view === "my_open") {
    list = list.filter(
      (l) =>
        l.ownerId === "usr_you" &&
        isOpenLead(l) &&
        (isSequenceReady(l) || isWorkableLead(l) || isInInstantly(l)),
    );
  }
  if (view === "high_icp") {
    list = list.filter(
      (l) =>
        (l.icpTier === "A" || l.icpTier === "B") &&
        isSequenceReady(l),
    );
  }
  if (view === "stale_7d") {
    list = list.filter(
      (l) =>
        isSequenceReady(l) &&
        !isInInstantly(l) &&
        daysSince(l.lastTouch, DEMO_NOW) >= 7,
    );
  }
  if (view === "closing_month") {
    list = list.filter(
      (l) =>
        isOpenLead(l) &&
        l.scoreIntent === "high" &&
        (l.amountHint ?? 0) > 0 &&
        isWorkableLead(l),
    );
  }

  return list.sort((a, b) => {
    // Prefer non-HVAC when both sequence-ready (rebalance signal)
    const sa = isSequenceReady(a) ? 0 : 1;
    const sb = isSequenceReady(b) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const pa = leadPriority(a, DEMO_NOW);
    const pb = leadPriority(b, DEMO_NOW);
    const r = priorityRank(pa.priority) - priorityRank(pb.priority);
    if (r !== 0) return r;
    // Diversity: non-HVAC first in ties
    if (a.vertical === "hvac" && b.vertical !== "hvac") return 1;
    if (b.vertical === "hvac" && a.vertical !== "hvac") return -1;
    if (b.icpScore !== a.icpScore) return b.icpScore - a.icpScore;
    return daysSince(b.lastTouch, DEMO_NOW) - daysSince(a.lastTouch, DEMO_NOW);
  });
}

export interface LeadFilterState {
  query: string;
  priority: Priority | "all";
  owner: string;
  vertical: Vertical | "all";
  lifecycle: LeadLifecycle | "all";
  minIcp: number;
  enrichment: "all" | "none" | "partial" | "complete" | "failed";
  verified: "all" | "yes" | "no";
  emailVerify: EmailVerificationStatus | "all";
  sequenceOnly: boolean;
  state: string;
}

export const defaultLeadFilters: LeadFilterState = {
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
};

export function applyLeadFilters(items: Lead[], f: LeadFilterState): Lead[] {
  const q = f.query.trim().toLowerCase();
  return items.filter((l) => {
    if (f.sequenceOnly && !isSequenceReady(l)) return false;
    if (f.vertical !== "all" && l.vertical !== f.vertical) return false;
    if (f.lifecycle !== "all" && l.lifecycle !== f.lifecycle) return false;
    if (f.owner !== "all" && l.ownerId !== f.owner) return false;
    if (f.minIcp > 0 && l.icpScore < f.minIcp) return false;
    if (f.enrichment !== "all" && l.enrichmentStatus !== f.enrichment)
      return false;
    if (f.verified === "yes" && !l.ownerVerified) return false;
    if (f.verified === "no" && l.ownerVerified) return false;
    if (f.emailVerify !== "all" && l.emailVerificationStatus !== f.emailVerify)
      return false;
    if (f.state !== "all" && (l.state ?? "") !== f.state) return false;
    if (f.priority !== "all") {
      if (leadPriority(l, DEMO_NOW).priority !== f.priority) return false;
    }
    if (!q) return true;
    return (
      l.name.toLowerCase().includes(q) ||
      l.company.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.vertical.includes(q) ||
      l.lifecycle.includes(q) ||
      (l.state ?? "").toLowerCase().includes(q) ||
      (l.instantlyCampaignName ?? "").toLowerCase().includes(q)
    );
  });
}

export function filterAccounts(items: Account[], view: ListView): Account[] {
  let list = [...items];
  if (view === "my_open" || view === "ready" || view === "sequence_ready") {
    list = list.filter((a) => a.ownerId === "usr_you" && a.status !== "churned");
  }
  if (view === "stale_7d") {
    list = list.filter((a) => daysSince(a.lastTouch, DEMO_NOW) >= 7);
  }
  if (view === "closing_month") {
    list = list.filter((a) => a.openOpps > 0 && a.ownerId === "usr_you");
  }
  return list.sort((a, b) => {
    const pa = accountPriority(a, DEMO_NOW);
    const pb = accountPriority(b, DEMO_NOW);
    const r = priorityRank(pa.priority) - priorityRank(pb.priority);
    if (r !== 0) return r;
    return b.arr - a.arr;
  });
}

export function filterOpps(items: Opportunity[], view: ListView): Opportunity[] {
  let list = [...items];
  if (
    view === "my_open" ||
    view === "ready" ||
    view === "sequence_ready"
  ) {
    list = list.filter((o) => o.ownerId === "usr_you" && isOpenOpp(o));
  }
  if (view === "stale_7d") {
    list = list.filter(
      (o) => isOpenOpp(o) && daysSince(o.lastTouch, DEMO_NOW) >= 7,
    );
  }
  if (view === "closing_month") {
    list = list.filter((o) => {
      if (!isOpenOpp(o) || !o.closeDate) return false;
      const d = daysUntil(o.closeDate, DEMO_NOW);
      return d <= 30;
    });
  }
  return list.sort((a, b) => {
    const pa = oppPriority(a, DEMO_NOW);
    const pb = oppPriority(b, DEMO_NOW);
    const r = priorityRank(pa.priority) - priorityRank(pb.priority);
    if (r !== 0) return r;
    const da = a.closeDate ? daysUntil(a.closeDate, DEMO_NOW) : 999;
    const db = b.closeDate ? daysUntil(b.closeDate, DEMO_NOW) : 999;
    return da - db;
  });
}

/** Home queue: sequence-ready not yet loaded (multi-vertical preferred) */
export function queueLeads(items: Lead[]): Lead[] {
  return filterLeads(items, "sequence_ready").filter((l) => {
    const p = leadPriority(l, DEMO_NOW).priority;
    return p !== "P3" || l.vertical !== "hvac";
  });
}

export function queueOpps(items: Opportunity[]): Opportunity[] {
  return filterOpps(items, "my_open").filter((o) => {
    const p = oppPriority(o, DEMO_NOW).priority;
    return (
      p === "P1" ||
      (p === "P2" && (!o.nextAction || daysSince(o.lastTouch, DEMO_NOW) >= 5))
    );
  });
}

export function queueAccounts(items: Account[]): Account[] {
  return filterAccounts(items, "my_open").filter((a) => {
    const p = accountPriority(a, DEMO_NOW).priority;
    return p === "P1" || a.health === "risk" || a.status === "at_risk";
  });
}

export type PriorityFilter = Priority | "all";

export function activitiesForEntity(
  activities: import("./types").Activity[],
  type: string,
  id: string,
) {
  return activities
    .filter(
      (a) =>
        (a.relatedType === type && a.relatedId === id) ||
        (a.secondaryRelatedType === type && a.secondaryRelatedId === id),
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}
