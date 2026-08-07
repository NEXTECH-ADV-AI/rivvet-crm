import type {
  Account,
  Lead,
  Opportunity,
  OppStage,
  Priority,
  PriorityResult,
} from "./types";
import { users } from "./seed";
import {
  isInInstantly,
  isOpenLifecycle,
  isSequenceReady,
  isWorkableLead,
  LIFECYCLE_LABEL,
  needsEmailVerify,
  needsEnrich,
} from "./lead-model";
import { PROD_OPP_STAGES } from "./prod-mirror";

const DAY = 24 * 60 * 60 * 1000;

export function daysSince(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

export function daysUntil(iso: string, now = Date.now()): number {
  return Math.floor((new Date(iso).getTime() - now) / DAY);
}

function isOpenOpp(o: Opportunity) {
  return o.stage !== "closed_won" && o.stage !== "closed_lost";
}

/**
 * Lead priority for GTM ops — sequence path first, not dial.
 * Scrapes without enrich path are P3 by design.
 */
export function leadPriority(lead: Lead, now = Date.now()): PriorityResult {
  const reasons: string[] = [];
  let priority: Priority = "P3";
  const life = lead.lifecycle;
  const touchAge = daysSince(lead.lastTouch, now);

  if (life === "disqualified" || life === "closed_lost") {
    return { priority: "P3", reasons: ["Closed / DQ"] };
  }
  if (life === "closed_won") {
    return { priority: "P3", reasons: ["Won"] };
  }

  // Sequence-ready not loaded = top GTM ops priority
  if (isSequenceReady(lead) && !isInInstantly(lead)) {
    priority = "P1";
    reasons.push(
      lead.vertical === "hvac"
        ? "Sequence-ready · HVAC (cap loads)"
        : `Sequence-ready · ${lead.vertical} — load GO`,
    );
  }

  if (needsEmailVerify(lead) && lead.emailVerificationStatus === "pending") {
    priority = priority === "P1" ? "P1" : "P2";
    reasons.push("Has email · needs NeverBounce");
  }

  if (needsEnrich(lead) && lead.websiteUrl) {
    if (priority === "P3") priority = "P2";
    reasons.push("Has website · enrich backlog");
  }

  if (isInInstantly(lead) && lead.emailReplied) {
    priority = "P1";
    reasons.push("In Instantly · replied — human follow-up");
  } else if (isInInstantly(lead) && lead.emailOpened) {
    if (priority === "P3") priority = "P2";
    reasons.push("In Instantly · opened");
  }

  // Post-sequence sales stages
  if (
    isWorkableLead(lead) &&
    ["qualified_discovery", "demo_booked", "demo_held", "proposal_out"].includes(
      life,
    )
  ) {
    if (!lead.nextAction) {
      priority = "P1";
      reasons.push("Sales stage · missing next step");
    } else if (
      lead.nextActionDue != null &&
      daysUntil(lead.nextActionDue, now) < 0
    ) {
      priority = "P1";
      reasons.push("Next step overdue");
    }
  }

  if (life === "scraped") {
    return {
      priority: "P3",
      reasons: reasons.length
        ? reasons
        : ["Scraped inventory — enrich before AE/sequence"],
    };
  }

  if (priority === "P3" && isSequenceReady(lead) && touchAge >= 7) {
    priority = "P2";
    reasons.push("Sequence-ready stale >7d");
  }

  if (reasons.length === 0) reasons.push("Healthy / lower priority");
  return { priority, reasons };
}

export function accountPriority(
  account: Account,
  now = Date.now(),
): PriorityResult {
  const reasons: string[] = [];
  let priority: Priority = "P3";
  const touchAge = daysSince(account.lastTouch, now);
  const missingNext = !account.nextAction;
  const highValue = account.arr >= 50000;

  if (account.health === "risk" || account.status === "at_risk") {
    priority = "P1";
    reasons.push("At risk");
  }
  if (highValue && touchAge >= 14) {
    priority = "P1";
    reasons.push("High ARR + no touch ≥14d");
  }
  if (missingNext && account.status === "active") {
    priority = priority === "P1" ? "P1" : "P2";
    reasons.push("Missing next step");
  }
  if (highValue && account.openOpps === 0 && touchAge >= 7) {
    if (priority === "P3") priority = "P2";
    reasons.push("High value, no open opp");
  }
  if (priority === "P3" && touchAge >= 21) {
    priority = "P2";
    reasons.push("Stale account");
  }

  if (reasons.length === 0) reasons.push("Healthy");
  return { priority, reasons };
}

export function oppPriority(
  opp: Opportunity,
  now = Date.now(),
): PriorityResult {
  const reasons: string[] = [];
  let priority: Priority = "P3";

  if (!isOpenOpp(opp)) {
    return { priority: "P3", reasons: ["Closed"] };
  }

  const stageAge = daysSince(opp.stageEnteredAt, now);
  const touchAge = daysSince(opp.lastTouch, now);
  const closeIn = opp.closeDate ? daysUntil(opp.closeDate, now) : 999;
  const missingNext = !opp.nextAction;
  const overdue =
    opp.nextActionDue != null && daysUntil(opp.nextActionDue, now) < 0;
  const closingThisMonth = closeIn >= 0 && closeIn <= 30;
  const large = opp.amount >= 25000;

  if (missingNext) {
    priority = "P1";
    reasons.push("Missing next step");
  }
  if (overdue) {
    priority = "P1";
    reasons.push("Next step overdue");
  }
  if (closingThisMonth && (missingNext || touchAge >= 3)) {
    priority = "P1";
    reasons.push("Closing this month + needs action");
  }
  if (stageAge >= 14 && opp.stage === "proposal_out") {
    priority = "P1";
    reasons.push(`Stage aging ${stageAge}d`);
  }
  if (closeIn < 0 && isOpenOpp(opp) && opp.closeDate) {
    priority = "P1";
    reasons.push("Past close date");
  }

  if (priority === "P3") {
    if (closingThisMonth) {
      priority = "P2";
      reasons.push("Closing this month");
    } else if (large && touchAge >= 5) {
      priority = "P2";
      reasons.push("Large deal, cooling");
    } else if (touchAge >= 7) {
      priority = "P2";
      reasons.push("Stale >7d");
    } else if (stageAge >= 7) {
      priority = "P2";
      reasons.push("Stage aging");
    }
  }

  if (reasons.length === 0) reasons.push("On track");
  return { priority, reasons };
}

export function priorityRank(p: Priority): number {
  return p === "P1" ? 0 : p === "P2" ? 1 : 2;
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatRelative(iso: string, now = Date.now()): string {
  const d = daysSince(iso, now);
  if (d === 0) return "Today";
  if (d === 1) return "1d ago";
  if (d < 0) return "Future";
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(
    iso.includes("T") ? iso : iso + "T12:00:00",
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export const OWNER_LABEL: Record<string, string> = Object.fromEntries(
  users.map((u) => [u.id, u.displayName]),
);

export const STAGE_LABEL: Record<string, string> = {
  ...LIFECYCLE_LABEL,
  ...Object.fromEntries(PROD_OPP_STAGES.map((s) => [s.value, s.label])),
  active: "Active",
  at_risk: "At risk",
  churned: "Churned",
  prospect: "Prospect",
  engaged: "Engaged",
  opportunity: "Opportunity",
  customer: "Customer",
  discovery: "Qualified",
  proposal: "Proposal / Contract",
  negotiation: "Proposal / Contract",
  verbal: "Proposal / Contract",
  working: "Working",
  warm: "Warm",
  owner_verified: "Owner verified",
  new: "New",
};

export const OPEN_STAGES = PROD_OPP_STAGES.filter((s) => s.isOpen).map(
  (s) => s.value,
) as OppStage[];

export const KANBAN_STAGES: OppStage[] = PROD_OPP_STAGES.map((s) => s.value);
