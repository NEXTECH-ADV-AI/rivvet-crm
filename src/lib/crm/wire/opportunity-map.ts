/**
 * Map production crm_opportunities → Opportunity.
 * @see packages/ops-hub/lib/crm/read-adapters.ts pipelineDirectoryPath
 */

import { emptyDealDraft } from "../deal-catalog";
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

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
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
  // legacy / alternate labels
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
  if (e.includes("brayden") || e.includes("rivvet")) return "usr_you";
  return "usr_you";
}

function accountNameOf(row: ProdOppRow): string {
  const acc = row.accounts;
  if (acc && typeof acc === "object" && !Array.isArray(acc)) {
    return str((acc as { name?: string }).name, "—");
  }
  if (Array.isArray(acc) && acc[0] && typeof acc[0] === "object") {
    return str((acc[0] as { name?: string }).name, "—");
  }
  return str(row.company_name || row.account_name, "—");
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

export function mapOpportunityRow(row: ProdOppRow): Opportunity {
  const id = str(row.opportunity_id || row.deal_id || row.id);
  const stage = mapOppStage(row.stage);
  const amount = num(row.amount ?? row.contract_value);
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
  const start =
    closeDate || new Date().toISOString().slice(0, 10);
  const deal = emptyDealDraft(start);
  // Prefer amount-driven monthly estimate for display
  if (amount > 0) {
    deal.productId = amount >= 30000 ? "unlimited" : "value_based";
  }

  const gtm = row.source_gtm_lead_id
    ? str(row.source_gtm_lead_id)
    : row.gtm_lead_id
      ? str(row.gtm_lead_id)
      : null;

  return {
    id,
    gtmLeadId: gtm,
    name: str(row.opportunity_name || row.company_name, "Opportunity"),
    accountId: row.account_id ? str(row.account_id) : null,
    accountName: accountNameOf(row),
    primaryContactId: row.primary_contact_id
      ? str(row.primary_contact_id)
      : null,
    stage,
    amount,
    monthlyAmount: amount > 0 ? Math.round(amount / 12) : null,
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
    packageSku: null,
    createdAt: str(row.created_at, updated),
    updatedAt: updated,
    sourceLeadId: gtm,
    tags: [stage, "live"].filter(Boolean),
    scorePriority: stageProb(stage),
    lostReason: null,
  };
}
