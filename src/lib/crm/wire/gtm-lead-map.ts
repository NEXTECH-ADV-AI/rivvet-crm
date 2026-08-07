/**
 * Map production gtm_leads row → sandbox Lead shape.
 */

import type {
  EmailVerificationStatus,
  EnrichmentStatus,
  Lead,
  LeadLifecycle,
  OwnerId,
  Vertical,
} from "../types";
import {
  intentFromIcp,
  isSequenceVertical,
  sumIcp,
  tierFromScore,
  INSTANTLY_CAMPAIGNS,
  type SequenceVertical,
} from "../lead-model";

export type GtmLeadRow = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asLifecycle(v: unknown): LeadLifecycle {
  return str(v, "scraped") as LeadLifecycle;
}

function asVertical(v: unknown): Vertical {
  const s = str(v, "other").toLowerCase().replace(/\s+/g, "_");
  const aliases: Record<string, Vertical> = {
    hvac: "hvac",
    plumbing: "plumbing",
    pool: "pool",
    pool_service: "pool",
    cleaning: "cleaning",
    landscaping: "landscaping",
    pest: "pest",
    pest_control: "pest",
    electrical: "electrical",
    roofing: "roofing",
    dental: "dental",
    fleet: "fleet",
    logistics: "logistics",
    field_service: "field_service",
    commerce: "commerce",
  };
  return aliases[s] ?? "other";
}

function asEnrichment(row: GtmLeadRow): EnrichmentStatus {
  const e = str(row.enrichment_status || row.enrichmentStatus);
  if (e === "none" || e === "partial" || e === "complete" || e === "failed")
    return e;
  const status = asLifecycle(row.status);
  if (status === "scraped") return "none";
  if (status === "enrich_failed") return "failed";
  if (status === "enriched") return "partial";
  return "complete";
}

function asEmailVerify(row: GtmLeadRow): EmailVerificationStatus {
  const e = str(
    row.email_verification_status || row.emailVerificationStatus,
    "",
  ).toLowerCase();
  if (
    e === "valid" ||
    e === "invalid" ||
    e === "pending" ||
    e === "risky" ||
    e === "unknown"
  ) {
    return e;
  }
  const status = asLifecycle(row.status);
  if (
    [
      "verified",
      "loaded_to_instantly",
      "qualified_discovery",
      "demo_booked",
      "demo_held",
      "proposal_out",
    ].includes(status)
  ) {
    return "valid";
  }
  if (status === "verification_failed") return "invalid";
  return "pending";
}

function pickEmail(row: GtmLeadRow): string {
  return (
    str(row.owner_email) ||
    str(row.general_email) ||
    str(row.email) ||
    ""
  );
}

function pickName(row: GtmLeadRow): string {
  return (
    str(row.owner_name) ||
    str(row.contact_name) ||
    str(row.business_name) ||
    "Unknown"
  );
}

function campaignName(id: string | null, vertical: Vertical): string | null {
  if (!id) return null;
  if (isSequenceVertical(vertical)) {
    const c = INSTANTLY_CAMPAIGNS[vertical as SequenceVertical];
    if (c.id === id) return c.name;
  }
  return id.slice(0, 8);
}

export function mapGtmLeadRow(row: GtmLeadRow): Lead {
  const id = str(row.gtm_lead_id || row.id || row.external_ref, "unknown");
  const vertical = asVertical(row.vertical);
  const lifecycle = asLifecycle(row.status || row.lifecycle);
  const icpScore = num(
    row.qualification_score ?? row.priority_score ?? row.icp_score,
    50,
  );
  const email = pickEmail(row);
  const instantlyId = row.instantly_campaign_id
    ? str(row.instantly_campaign_id)
    : null;

  const part = Math.max(2, Math.min(20, Math.round(icpScore / 5)));
  const icp = {
    industryFit: part,
    sizeFit: part,
    geoFit: part,
    techFit: Math.max(2, part - 1),
    budgetSignal: Math.max(2, part - 2),
  };
  const score = sumIcp(icp) || icpScore;

  return {
    id: id.startsWith("L-") ? id : `L-${id.slice(0, 8)}`,
    gtmLeadId: str(row.gtm_lead_id || row.id) || undefined,
    externalRef: str(row.external_ref) || undefined,
    name: pickName(row),
    company: str(row.business_name || row.company, "—"),
    title: str(row.title || row.owner_title, "Owner"),
    email,
    phone: row.phone != null ? str(row.phone) : null,
    websiteUrl:
      row.website || row.website_url
        ? str(row.website || row.website_url)
        : null,
    lifecycle,
    status: lifecycle,
    ownerId: "unassigned" as OwnerId,
    source: str(row.source, "gtm"),
    sourceDetail: row.source_detail ? str(row.source_detail) : null,
    vertical,
    enrichmentStatus: asEnrichment(row),
    emailVerificationStatus: asEmailVerify(row),
    ownerVerified:
      bool(row.owner_verified) ||
      lifecycle === "verified" ||
      [
        "loaded_to_instantly",
        "qualified_discovery",
        "demo_booked",
        "demo_held",
        "proposal_out",
      ].includes(lifecycle),
    icpScore: score,
    icpTier: tierFromScore(score),
    icp,
    employeeBand: row.employee_band ? str(row.employee_band) : null,
    region: str(row.state || row.region, "—"),
    city: row.city ? str(row.city) : null,
    state: row.state ? str(row.state) : null,
    scoreIntent: intentFromIcp(score),
    nextAction: row.next_action ? str(row.next_action) : null,
    nextActionDue: row.next_action_due ? str(row.next_action_due) : null,
    emailOpened: bool(row.email_opened),
    emailReplied: bool(row.email_replied),
    dncFlag: bool(row.dnc_flag),
    marketingPaused: bool(row.marketing_paused),
    instantlyCampaignId: instantlyId,
    instantlyCampaignName: campaignName(instantlyId, vertical),
    opportunityCreated: bool(row.opportunity_created),
    demoBookedAt: row.demo_booked_at ? str(row.demo_booked_at) : null,
    lastTouch: str(
      row.updated_at || row.last_touch || row.created_at,
      new Date().toISOString(),
    ),
    createdAt: str(row.created_at, new Date().toISOString()),
    updatedAt: str(row.updated_at, new Date().toISOString()),
    amountHint: null,
    accountId: null,
    convertedOppId: null,
    tags: [vertical, lifecycle, str(row.state)].filter(Boolean),
    enrichedAt: row.enriched_at ? str(row.enriched_at) : null,
    scrapeBatch: row.scrape_batch ? str(row.scrape_batch) : null,
  };
}
