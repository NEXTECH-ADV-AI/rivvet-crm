/**
 * Sequence / Instantly query contract — mirror of production predicates.
 * Wire-up must implement these filters server-side with indexes.
 * Do NOT pull full gtm_leads client-side.
 */

import type {
  EmailVerificationStatus,
  Lead,
  LeadLifecycle,
  Vertical,
} from "./types";
import {
  INSTANTLY_CAMPAIGNS,
  isInInstantly,
  isSequenceReady,
  needsEmailVerify,
  needsEnrich,
  SEQUENCE_VERTICALS,
  type SequenceVertical,
} from "./lead-model";

export type SequenceListView =
  | "load_eligible"
  | "sequence_ready"
  | "needs_enrich"
  | "needs_verify"
  | "in_instantly"
  | "high_icp";

export interface SequenceListQuery {
  view: SequenceListView;
  vertical?: Vertical | "all";
  state?: string | "all";
  emailVerificationStatus?: EmailVerificationStatus | "all";
  lifecycle?: LeadLifecycle | "all";
  limit: number;
  cursor?: string | null;
}

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_GO_BATCH_SIZE = 50;

export const SEQUENCE_SQL = {
  sequenceReady: `
    vertical = ANY($sequence_verticals)
    AND email_verification_status = 'valid'
    AND email IS NOT NULL AND email <> ''
    AND COALESCE(dnc_flag, false) = false
    AND COALESCE(marketing_paused, false) = false
    AND enrichment_status NOT IN ('none', 'failed')
    AND status NOT IN ('disqualified', 'closed_lost')
  `,
  loadEligible: `
    /* sequence_ready AND */
    instantly_campaign_id IS NULL
    AND status <> 'loaded_to_instantly'
  `,
  indexes: [
    "gtm_leads (status)",
    "gtm_leads (vertical, state)",
    "gtm_leads (email_verification_status) WHERE email_verification_status = 'valid'",
    "gtm_leads (instantly_campaign_id) WHERE instantly_campaign_id IS NULL",
    "partial: load_eligible expression or materialized view",
  ],
  sequenceVerticals: SEQUENCE_VERTICALS,
} as const;

export function isLoadEligible(l: Lead): boolean {
  if (!isSequenceReady(l)) return false;
  if (isInInstantly(l)) return false;
  return true;
}

export function filterBySequenceView(
  items: Lead[],
  view: SequenceListView,
): Lead[] {
  switch (view) {
    case "load_eligible":
      return items.filter(isLoadEligible);
    case "sequence_ready":
      return items.filter(isSequenceReady);
    case "needs_enrich":
      return items.filter(needsEnrich);
    case "needs_verify":
      return items.filter(needsEmailVerify);
    case "in_instantly":
      return items.filter(isInInstantly);
    case "high_icp":
      return items.filter(
        (l) =>
          isLoadEligible(l) && (l.icpTier === "A" || l.icpTier === "B"),
      );
    default:
      return items;
  }
}

export function applySequenceQuery(
  items: Lead[],
  q: SequenceListQuery,
): Lead[] {
  let list = filterBySequenceView(items, q.view);
  if (q.vertical && q.vertical !== "all") {
    list = list.filter((l) => l.vertical === q.vertical);
  }
  if (q.state && q.state !== "all") {
    list = list.filter((l) => (l.state ?? "") === q.state);
  }
  if (q.emailVerificationStatus && q.emailVerificationStatus !== "all") {
    list = list.filter(
      (l) => l.emailVerificationStatus === q.emailVerificationStatus,
    );
  }
  if (q.lifecycle && q.lifecycle !== "all") {
    list = list.filter((l) => l.lifecycle === q.lifecycle);
  }
  list = [...list].sort((a, b) => {
    if (a.vertical === "hvac" && b.vertical !== "hvac") return 1;
    if (b.vertical === "hvac" && a.vertical !== "hvac") return -1;
    return b.icpScore - a.icpScore;
  });
  const limit = Math.min(
    Math.max(1, q.limit || DEFAULT_PAGE_LIMIT),
    MAX_PAGE_LIMIT,
  );
  return list.slice(0, limit);
}

export interface CampaignReadiness {
  vertical: SequenceVertical;
  campaignId: string;
  campaignName: string;
  loadEligible: number;
  inCampaign: number;
  status: "active" | "idle" | "kill_candidate";
  notes: string;
}

export function campaignReadiness(leads: Lead[]): CampaignReadiness[] {
  return SEQUENCE_VERTICALS.map((vertical) => {
    const meta = INSTANTLY_CAMPAIGNS[vertical];
    const loadEligible = leads.filter(
      (l) => l.vertical === vertical && isLoadEligible(l),
    ).length;
    const inCampaign = leads.filter(
      (l) =>
        l.vertical === vertical &&
        (l.instantlyCampaignId === meta.id ||
          l.instantlyCampaignName === meta.name ||
          (isInInstantly(l) && l.vertical === vertical)),
    ).length;
    let status: CampaignReadiness["status"] = "idle";
    let notes = "No loads in sample / prod idle";
    if (vertical === "hvac") {
      status = "kill_candidate";
      notes =
        "Prod HVAC Nat'l: sent with 0 replies — RCA before scale; prefer non-HVAC pilot";
    } else if (inCampaign > 0) {
      status = "active";
      notes = "Has loads in sample";
    } else if (loadEligible > 0) {
      status = "idle";
      notes = `${loadEligible} load-eligible — pilot candidate (≤50)`;
    }
    return {
      vertical,
      campaignId: meta.id,
      campaignName: meta.name,
      loadEligible,
      inCampaign,
      status,
      notes,
    };
  });
}

export function hvacLoadAllowed(
  loadEligibleByVertical: Partial<Record<Vertical, number>>,
  proposedHvacCount: number,
  proposedTotal: number,
): { ok: boolean; reason: string } {
  const nonHvac = SEQUENCE_VERTICALS.filter((v) => v !== "hvac").reduce(
    (s, v) => s + (loadEligibleByVertical[v] ?? 0),
    0,
  );
  if (nonHvac < 30) {
    return {
      ok: true,
      reason: `Non-HVAC ready thin (${nonHvac}) — cap waived; still prefer non-HVAC first`,
    };
  }
  if (proposedTotal === 0) return { ok: true, reason: "Empty batch" };
  const share = proposedHvacCount / proposedTotal;
  if (share > 0.35) {
    return {
      ok: false,
      reason: `HVAC would be ${Math.round(share * 100)}% of batch — max 35% when non-HVAC ready ≥ 30`,
    };
  }
  return { ok: true, reason: "HVAC share within 35% cap" };
}

export const LOAD_GO_CHECKLIST = [
  "Single vertical for this batch",
  "All rows load-eligible (valid email, seq vertical, not loaded, not DNC)",
  "Campaign ID matches vertical",
  "Batch size ≤ 50 (or written exception)",
  "HVAC share rule applied when non-HVAC supply ≥ 30",
  "State concentration reviewed if ≥80% one state",
  "NeverBounce invalid ≤ 3% (batch)",
  "Sending domains not in halt",
  "Loader deactivated after run",
  "Batch logged (vertical, count, campaign)",
] as const;
