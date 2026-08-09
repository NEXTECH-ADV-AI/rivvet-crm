/**
 * Map production crm_opportunities → Opportunity.
 * Open deals with $0 amount get Rivvet AI value-based base MRR ($500/mo)
 * so pipeline isn't inflated by Unlimited ($4k) rates.
 */

import { emptyDealDraft, priceDeal } from "../deal-catalog";
import { SERVICE_SETUP_FEE, SERVICE_VALUE_PRICE } from "../prod-mirror";
import type {
  ForecastCategory,
  LockedPaymentState,
  LockedSendState,
  OppStage,
  Opportunity,
  OwnerId,
  Vertical,
} from "../types";

export type ProdOppRow = Record<string, unknown>;

/** Default open-pipeline MRR when CRM has no amount (value-based base). */
export const DEFAULT_PIPELINE_MRR = SERVICE_VALUE_PRICE; // $500/mo

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const STAGES = new Set<string>([
  "qualified",
  "demo_booked",
  "demo_held",
  "proposal_out",
  "closed_won",
  "closed_lost",
]);

/** Map various prod stage strings → our OppStage */
export function mapOppStage(raw: unknown): OppStage {
  const s = str(raw, "qualified").toLowerCase().replace(/\s+/g, "_");
  if (STAGES.has(s)) return s as OppStage;
  const aliases: Record<string, OppStage> = {
    discovery: "qualified",
    qualified_discovery: "qualified",
    demo: "demo_booked",
    demo_scheduled: "demo_booked",
    proposal: "proposal_out",
    contract: "proposal_out",
    proposal_contract: "proposal_out",
    negotiation: "proposal_out",
    verbal: "proposal_out",
    won: "closed_won",
    lost: "closed_lost",
  };
  return aliases[s] ?? "qualified";
}

function ownerFromEmail(email: string | null): OwnerId {
  if (!email) return "unassigned";
  const e = email.toLowerCase();
  if (e.includes("maya")) return "usr_maya";
  if (e.includes("jordan")) return "usr_jordan";
  if (
    e.includes("brayden") ||
    e.includes("scott") ||
    e.includes("ryan") ||
    e.includes("@rivvetai.com")
  ) {
    return "usr_you";
  }
  return "usr_you";
}

function accountNameOf(row: ProdOppRow): string {
  const acc = row.accounts;
  if (acc && typeof acc === "object" && !Array.isArray(acc)) {
    return str((acc as { name?: string }).name, "");
  }
  if (Array.isArray(acc) && acc[0] && typeof acc[0] === "object") {
    return str((acc[0] as { name?: string }).name, "");
  }
  return str(row.company_name || row.account_name, "");
}

function stageProb(stage: OppStage): number {
  const m: Record<OppStage, number> = {
    qualified: 20,
    demo_booked: 40,
    demo_held: 60,
    proposal_out: 80,
    closed_won: 100,
    closed_lost: 0,
  };
  return m[stage];
}

function forecastFor(stage: OppStage): ForecastCategory {
  if (stage === "closed_won" || stage === "closed_lost") return "closed";
  if (stage === "proposal_out") return "best_case";
  if (stage === "demo_held") return "commit";
  return "pipeline";
}

/** QA / smoke rows that slip past is_test=false */
export function isPipelineJunk(row: ProdOppRow): boolean {
  if (row.is_test === true || row.is_test === "true") return true;
  const blob = [
    row.opportunity_name,
    row.company_name,
    row.test_reason,
    row.contact_email,
  ]
    .map((v) => str(v, "").toLowerCase())
    .join(" ");
  return (
    /\bqa\b/.test(blob) ||
    /e2e acceptance/.test(blob) ||
    /commerce smoke/.test(blob) ||
    /commerce verify/.test(blob) ||
    /test throwaway/.test(blob) ||
    /throwaway@/.test(blob) ||
    /\+qa-/.test(blob)
  );
}

/**
 * Resolve amount + monthly (MRR) for pipeline display.
 * Missing amounts on open deals → value-based base ($500/mo), not Unlimited $4k.
 */
function resolvePricing(
  stage: OppStage,
  rawAmount: number,
  start: string,
): {
  amount: number;
  monthlyAmount: number | null;
  deal: ReturnType<typeof emptyDealDraft>;
} {
  const deal = emptyDealDraft(start);
  deal.setupFee = SERVICE_SETUP_FEE;
  deal.termMonths = 12;
  deal.freeMonths = 0;

  if (rawAmount > 0) {
    // Small values (≤ $2k) look like monthly MRR already ($500 / $750)
    if (rawAmount <= 2000) {
      deal.productId = "value_based";
      const monthly = rawAmount;
      const tcv = SERVICE_SETUP_FEE + monthly * deal.termMonths;
      return { amount: tcv, monthlyAmount: monthly, deal };
    }
    // Larger values are TCV — derive MRR from term (12 mo default), not Unlimited SKU
    deal.productId = "value_based";
    const monthly = Math.round(
      Math.max(0, rawAmount - SERVICE_SETUP_FEE) / deal.termMonths,
    );
    return {
      amount: rawAmount,
      monthlyAmount: monthly > 0 ? monthly : DEFAULT_PIPELINE_MRR,
      deal,
    };
  }

  // Open (or won with missing $) → value-based base $500/mo
  if (stage !== "closed_lost") {
    deal.productId = "value_based";
    const priced = priceDeal(deal);
    // priceDeal uses SERVICE_VALUE_PRICE ($500)
    return {
      amount: priced.tcv,
      monthlyAmount: priced.monthly || DEFAULT_PIPELINE_MRR,
      deal,
    };
  }

  return { amount: 0, monthlyAmount: null, deal };
}

export function mapOpportunityRow(row: ProdOppRow): Opportunity {
  const id = str(row.opportunity_id || row.deal_id || row.id);
  const stage = mapOppStage(row.stage);
  const rawAmount = num(row.amount ?? row.contract_value);
  const updated = str(
    row.updated_at || row.created_at,
    new Date().toISOString(),
  );
  const closeDate = row.expected_close_date
    ? str(row.expected_close_date).slice(0, 10)
    : null;
  const ownerEmail = row.assigned_rep_email
    ? str(row.assigned_rep_email)
    : row.owner_email
      ? str(row.owner_email)
      : null;
  const start = closeDate || new Date().toISOString().slice(0, 10);
  const { amount, monthlyAmount, deal } = resolvePricing(
    stage,
    rawAmount,
    start,
  );

  const gtm = row.source_gtm_lead_id
    ? str(row.source_gtm_lead_id)
    : row.gtm_lead_id
      ? str(row.gtm_lead_id)
      : null;

  const accountName = accountNameOf(row);
  const rawName = str(row.opportunity_name || row.company_name, "");
  const name =
    rawName ||
    accountName ||
    (row.contact_email ? str(row.contact_email) : "") ||
    "Opportunity";

  return {
    id,
    gtmLeadId: gtm,
    name,
    accountId: row.account_id ? str(row.account_id) : null,
    accountName: accountName || "—",
    primaryContactId: row.primary_contact_id
      ? str(row.primary_contact_id)
      : null,
    stage,
    amount,
    monthlyAmount,
    currency: "USD",
    ownerId: ownerFromEmail(ownerEmail),
    closeDate,
    nextAction: row.next_action ? str(row.next_action) : null,
    nextActionDue: row.next_action_due ? str(row.next_action_due) : null,
    lastTouch: updated,
    stageEnteredAt: updated,
    probability: stageProb(stage),
    forecastCategory: forecastFor(stage),
    vertical: "other" as Vertical,
    region: "—",
    notes: str(row.test_reason || "", ""),
    source: str(row.source || "crm_opportunities"),
    engagement: { opened: null, replied: 0, calls: 0 },
    deal,
    lockedSendState: "none" as LockedSendState,
    lockedPaymentState: "none" as LockedPaymentState,
    packageSku:
      deal.productId === "unlimited"
        ? "rivvet_ai_unlimited"
        : deal.productId === "value_based"
          ? "rivvet_ai_value_based"
          : null,
    createdAt: str(row.created_at, updated),
    updatedAt: updated,
    sourceLeadId: gtm,
    tags: [stage, "live"].filter(Boolean),
    scorePriority: stageProb(stage),
    lostReason: null,
  };
}
