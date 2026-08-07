/**
 * Production CRM mirror — schemas and constants from live CRM (crm.rivvetai.com).
 * Do NOT invent fields. Wire via Supabase REST; this file is the contract the UI expects.
 *
 * Note: ops/command is a separate product. This package is CRM only.
 *
 * Key tables:
 *  - gtm_leads          (lead + opportunity-ish row)
 *  - deals              (contract lifecycle)
 *  - accounts, contacts, activities
 *  - opportunity stages on deals / gtm_leads.pipeline_stage
 *
 * LOCKED on wire-up: sendContract, PandaDoc, Stripe, crm_create_contract_draft RPC.
 */

/** Prod opportunity stages */
export type ProdOppStage =
  | "qualified"
  | "demo_booked"
  | "demo_held"
  | "proposal_out"
  | "closed_won"
  | "closed_lost";

export const PROD_OPP_STAGES: {
  value: ProdOppStage;
  label: string;
  progress: number;
  isOpen: boolean;
}[] = [
  { value: "qualified", label: "Qualified", progress: 20, isOpen: true },
  { value: "demo_booked", label: "Demo Booked", progress: 40, isOpen: true },
  { value: "demo_held", label: "Demo Held", progress: 60, isOpen: true },
  {
    value: "proposal_out",
    label: "Proposal / Contract",
    progress: 80,
    isOpen: true,
  },
  { value: "closed_won", label: "Closed Won", progress: 100, isOpen: false },
  { value: "closed_lost", label: "Closed Lost", progress: 100, isOpen: false },
];

/** Status written to gtm_leads.status when stage moves */
export const PROD_OPP_STATUS_WRITE: Record<ProdOppStage, string> = {
  qualified: "qualified_discovery",
  demo_booked: "demo_booked",
  demo_held: "demo_held",
  proposal_out: "proposal_out",
  closed_won: "closed_won",
  closed_lost: "closed_lost",
};

export const PROD_LOST_REASONS = ["no-show", "no-fit", "price", "timing"] as const;
export type ProdLostReason = (typeof PROD_LOST_REASONS)[number];

/**
 * gtm_leads.status values used across scrape → sales
 */
export type ProdLeadStatus =
  | "scraped"
  | "enriched"
  | "enrich_failed"
  | "verified"
  | "verification_failed"
  | "loaded_to_instantly"
  | "inbound_callback"
  | "qualified_discovery"
  | "demo_booked"
  | "demo_held"
  | "proposal_out"
  | "closed_won"
  | "closed_lost"
  | "nurture"
  | "disqualified";

export const PROD_LEAD_STATUS_LABEL: Record<ProdLeadStatus, string> = {
  scraped: "Scraped",
  enriched: "Enriched",
  enrich_failed: "Enrich failed",
  verified: "Owner verified",
  verification_failed: "Verify failed",
  loaded_to_instantly: "In Instantly",
  inbound_callback: "Inbound callback",
  qualified_discovery: "Qualified",
  demo_booked: "Demo booked",
  demo_held: "Demo held",
  proposal_out: "Proposal out",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
  nurture: "Nurture",
  disqualified: "Disqualified",
};

/** Dial queue tiers (parity only — not productized in sequence-first CRM) */
export type ProdDialTier =
  | "CALLBACK"
  | "A0"
  | "A1"
  | "A2"
  | "B"
  | "C"
  | "EXCLUDE";

export const A0_MIN_SCORE = 60;
export const MAX_HUMAN_ATTEMPTS = 6;

/** deals.status lifecycle */
export type ProdDealStatus =
  | "draft"
  | "send_pending"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "paid"
  | "lost";

/** Service contract constants */
export const SERVICE_DEAL_TYPE = "subscription_service";
export const SERVICE_SETUP_FEE = 500;
export const SERVICE_UNLIMITED_PLAN = "Rivvet AI Unlimited";
export const SERVICE_VALUE_BASED_PLAN = "Rivvet AI Value-Based Pricing";
export const SERVICE_UNLIMITED_PRICE = 4000;
export const SERVICE_VALUE_PRICE = 500;

/** Commerce contract constants */
export const COMMERCE_DEAL_TYPE = "commerce_partnership_order";
export const COMMERCE_SETUP_FEE = 1000;
export const COMMERCE_MONTHLY_RETAINER = 250;
export const COMMERCE_PRODUCT_NAME = "Rivvet Commerce - Launch Partner";
export const COMMERCE_PRODUCT_DESCRIPTION =
  "Commerce optimization, AI content operations, storefront tuning, and customer voice improvements";

export type CommercePerfOption = "standard" | "test_run" | "custom";

export const COMMERCE_PERF: Record<
  Exclude<CommercePerfOption, "custom">,
  { label: string; rate: number; termMonths: number }
> = {
  standard: { label: "Option A — Standard", rate: 5, termMonths: 12 },
  test_run: { label: "Option B — Test Run", rate: 15, termMonths: 6 },
};

/**
 * Wire-up map (CRM → Supabase REST). Paths relative to
 * NEXT_PUBLIC_SUPABASE_URL/rest/v1
 */
export const PROD_API_PATHS = {
  gtmLeads: "/gtm_leads",
  deals: "/deals",
  accounts: "/accounts",
  contacts: "/contacts",
  activities: "/activities",
  createContractDraft: "/rpc/crm_create_contract_draft",
} as const;

export const PROD_ROUTE_PREFIX = "/crm";
