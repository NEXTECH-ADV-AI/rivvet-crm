import type {
  EmailVerificationStatus,
  EnrichmentStatus,
  IcpBreakdown,
  IcpTier,
  Lead,
  LeadLifecycle,
  Vertical,
} from "./types";
import { PROD_LEAD_STATUS_LABEL, A0_MIN_SCORE } from "./prod-mirror";

export const LIFECYCLE_ORDER: LeadLifecycle[] = [
  "scraped",
  "enriched",
  "verified",
  "loaded_to_instantly",
  "qualified_discovery",
  "demo_booked",
  "demo_held",
  "proposal_out",
  "nurture",
  "disqualified",
];

export const LIFECYCLE_LABEL: Record<string, string> = {
  ...PROD_LEAD_STATUS_LABEL,
  owner_verified: "Owner verified",
  warm: "Warm",
  working: "Working",
  qualified: "Qualified",
};

export const VERTICAL_LABEL: Record<Vertical, string> = {
  hvac: "HVAC",
  plumbing: "Plumbing",
  electrical: "Electrical",
  roofing: "Roofing",
  pool: "Pool service",
  cleaning: "Cleaning",
  landscaping: "Landscaping",
  pest: "Pest control",
  dental: "Dental",
  fleet: "Fleet",
  logistics: "Logistics",
  field_service: "Field service",
  commerce: "Commerce",
  other: "Other",
};

/** Verticals that map 1:1 to GTM Instantly campaigns */
export const SEQUENCE_VERTICALS = [
  "hvac",
  "pool",
  "cleaning",
  "plumbing",
  "pest",
  "landscaping",
] as const satisfies readonly Vertical[];

export type SequenceVertical = (typeof SEQUENCE_VERTICALS)[number];

export const ALL_VERTICALS: Vertical[] = [
  ...SEQUENCE_VERTICALS,
  "electrical",
  "roofing",
  "dental",
  "fleet",
  "logistics",
  "field_service",
  "commerce",
  "other",
];

export const INSTANTLY_CAMPAIGNS: Record<
  SequenceVertical,
  { id: string; name: string }
> = {
  hvac: { id: "camp_hvac_natl", name: "HVAC Nat'l" },
  pool: { id: "camp_pool", name: "Pool Service" },
  cleaning: { id: "camp_cleaning", name: "Cleaning" },
  plumbing: { id: "camp_plumbing", name: "Plumbing" },
  pest: { id: "camp_pest", name: "Pest Control" },
  landscaping: { id: "camp_landscaping", name: "Landscaping" },
};

export const TARGET_STATES = [
  "AZ",
  "CA",
  "CO",
  "FL",
  "GA",
  "IL",
  "NC",
  "NV",
  "NY",
  "OH",
  "OR",
  "PA",
  "TX",
  "UT",
  "WA",
] as const;

export function isSequenceVertical(v: Vertical): v is SequenceVertical {
  return (SEQUENCE_VERTICALS as readonly string[]).includes(v);
}

export function isSequenceReady(l: {
  email: string;
  emailVerificationStatus: EmailVerificationStatus;
  vertical: Vertical;
  dncFlag?: boolean;
  marketingPaused?: boolean;
  enrichmentStatus: EnrichmentStatus;
  lifecycle: LeadLifecycle;
}): boolean {
  if (l.dncFlag || l.marketingPaused) return false;
  if (l.lifecycle === "disqualified" || l.lifecycle === "closed_lost")
    return false;
  if (!isSequenceVertical(l.vertical)) return false;
  if (l.emailVerificationStatus !== "valid") return false;
  if (!l.email || !l.email.includes("@")) return false;
  if (l.enrichmentStatus === "none" || l.enrichmentStatus === "failed")
    return false;
  return true;
}

export function isInInstantly(l: {
  instantlyCampaignId?: string | null;
  lifecycle: LeadLifecycle;
}): boolean {
  return (
    Boolean(l.instantlyCampaignId) || l.lifecycle === "loaded_to_instantly"
  );
}

export function needsEnrich(l: {
  lifecycle: LeadLifecycle;
  enrichmentStatus: EnrichmentStatus;
  websiteUrl?: string | null;
}): boolean {
  if (l.lifecycle === "disqualified") return false;
  return (
    l.lifecycle === "scraped" ||
    l.lifecycle === "enrich_failed" ||
    l.enrichmentStatus === "none" ||
    l.enrichmentStatus === "failed"
  );
}

export function needsEmailVerify(l: {
  lifecycle: LeadLifecycle;
  enrichmentStatus: EnrichmentStatus;
  emailVerificationStatus: EmailVerificationStatus;
  email: string;
}): boolean {
  if (!l.email || !l.email.includes("@")) return false;
  if (l.enrichmentStatus === "none" || l.enrichmentStatus === "failed")
    return false;
  return (
    l.emailVerificationStatus === "pending" ||
    l.emailVerificationStatus === "unknown" ||
    l.lifecycle === "enriched"
  );
}

export function isWorkableLead(l: {
  lifecycle: LeadLifecycle;
  enrichmentStatus: EnrichmentStatus;
  ownerVerified: boolean;
  icpScore: number;
  emailVerificationStatus?: EmailVerificationStatus;
}): boolean {
  if (
    l.lifecycle === "disqualified" ||
    l.lifecycle === "closed_lost" ||
    l.lifecycle === "closed_won"
  ) {
    return false;
  }
  if (
    l.lifecycle === "scraped" ||
    l.lifecycle === "enrich_failed" ||
    l.lifecycle === "verification_failed"
  ) {
    return false;
  }
  if (l.enrichmentStatus === "none" || l.enrichmentStatus === "failed") {
    return false;
  }
  if (l.lifecycle === "enriched" && !l.ownerVerified) return false;

  return [
    "verified",
    "loaded_to_instantly",
    "inbound_callback",
    "qualified_discovery",
    "demo_booked",
    "demo_held",
    "proposal_out",
    "nurture",
  ].includes(l.lifecycle);
}

export function isOpenLifecycle(s: LeadLifecycle) {
  return (
    s !== "disqualified" && s !== "closed_won" && s !== "closed_lost"
  );
}

export function tierFromScore(score: number): IcpTier {
  if (score >= 80) return "A";
  if (score >= A0_MIN_SCORE) return "B";
  if (score >= 45) return "C";
  return "D";
}

export function intentFromIcp(score: number): "high" | "med" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "med";
  return "low";
}

export function sumIcp(b: IcpBreakdown): number {
  return (
    b.industryFit + b.sizeFit + b.geoFit + b.techFit + b.budgetSignal
  );
}

export function campaignForVertical(v: Vertical): string | null {
  if (!isSequenceVertical(v)) return null;
  return INSTANTLY_CAMPAIGNS[v].name;
}

export function sequenceStats(leads: Lead[]) {
  const ready = leads.filter(isSequenceReady);
  const notLoaded = ready.filter((l) => !isInInstantly(l));
  const loaded = leads.filter(isInInstantly);
  const byVert: Partial<Record<Vertical, number>> = {};
  for (const l of ready) {
    byVert[l.vertical] = (byVert[l.vertical] ?? 0) + 1;
  }
  const hvacReady = byVert.hvac ?? 0;
  const hvacShare =
    ready.length > 0 ? Math.round((hvacReady / ready.length) * 100) : 0;
  const states = new Set(
    ready.map((l) => l.state).filter(Boolean) as string[],
  );
  return {
    sequenceReady: ready.length,
    readyNotLoaded: notLoaded.length,
    inInstantly: loaded.length,
    needsEnrich: leads.filter(needsEnrich).length,
    needsVerify: leads.filter(needsEmailVerify).length,
    byVerticalReady: byVert,
    hvacShareOfReady: hvacShare,
    statesInReady: states.size,
  };
}

export const LEAD_OPS_PLAYBOOK = [
  {
    title: "North star = sequence-ready, not total scrapes",
    body: "~53k rows · ~1k valid email · ~0.5–0.9k launchable. Count what can enter Instantly.",
  },
  {
    title: "Multi-vertical loads, not HVAC-only",
    body: "Six campaigns exist. Load GO per vertical with caps so HVAC ≠ 70% of sends.",
  },
  {
    title: "Multi-geo scrape matrix",
    body: "S1 = vertical × metro/national. Drop default 5-state HVAC-only feed.",
  },
  {
    title: "Enrich → verify before more scrape",
    body: "Clear backlog on website rows before another Apify dump.",
  },
  {
    title: "Cold call is out of critical path",
    body: "AI outbound paused until multi-vertical email produces replies.",
  },
  {
    title: "Fix 0-reply HVAC before scaling HVAC",
    body: "HVAC Nat'l 819 sends / 0 replies — diagnose before volume.",
  },
] as const;
