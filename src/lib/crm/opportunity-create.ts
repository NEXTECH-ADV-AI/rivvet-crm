/** Creating an Opportunity from a lead, an account, or the Opportunities tab (RIV-1555). */

export const NEW_OPP_STAGES = [
  { value: "qualified", label: "Qualified" },
  { value: "demo_booked", label: "Demo booked" },
  { value: "demo_held", label: "Demo held" },
] as const;
export type NewOppStage = (typeof NEW_OPP_STAGES)[number]["value"];

export type NewOpportunity = {
  company: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  stage: NewOppStage;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// No quotes, commas or parens: the email goes into a PostgREST or=() filter.
const EMAIL = /^[^\s@",()]+@[^\s@",()]+\.[^\s@",()]+$/;

const text = (v: unknown, max: number) => {
  const s = String(v ?? "")
    .trim()
    .slice(0, max);
  return s || null;
};

export type CreateOpportunityInput =
  | { from: "lead"; gtmLeadId: string }
  | { from: "account"; accountId: string; stage?: NewOppStage }
  | ({ from: "new" } & NewOpportunity);

/** Trust boundary for createOpportunityFn: ids are uuids, the form is trimmed and checked. */
export function parseCreateOpportunity(data: unknown): CreateOpportunityInput {
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.from === "lead" || d.from === "account") {
    const id = String(d.from === "lead" ? d.gtmLeadId : d.accountId);
    if (!UUID.test(id)) throw new Error("Invalid record id");
    if (d.from === "lead") return { from: "lead", gtmLeadId: id };
    const stage = NEW_OPP_STAGES.find((s) => s.value === d.stage)?.value;
    return stage ? { from: "account", accountId: id, stage } : { from: "account", accountId: id };
  }
  if (d.from !== "new") throw new Error("Unknown opportunity source");
  const company = text(d.company, 120);
  if (!company) throw new Error("Company name is required");
  const email = text(d.email, 200)?.toLowerCase() ?? null;
  if (email && !EMAIL.test(email)) throw new Error("That email doesn't look right");
  const stage = NEW_OPP_STAGES.find((s) => s.value === d.stage)?.value ?? "qualified";
  return {
    from: "new",
    company,
    contact: text(d.contact, 120),
    email,
    phone: text(d.phone, 40),
    stage,
  };
}

const CLOSED = new Set(["closed_won", "closed_lost"]);

/**
 * An account gets a new Opportunity only when none is open, and from a lead that has none yet
 * (crm_opportunities is unique on source_gtm_lead_id).
 */
export function accountOpportunityPlan(
  leadIds: string[],
  opps: { opportunity_id: string; stage: string; source_gtm_lead_id: string | null }[],
):
  | { kind: "existing"; opportunityId: string }
  | { kind: "create"; gtmLeadId: string }
  | { kind: "none" } {
  const open = opps.find((o) => !CLOSED.has(o.stage));
  if (open) return { kind: "existing", opportunityId: open.opportunity_id };
  const used = new Set(opps.map((o) => o.source_gtm_lead_id));
  const free = leadIds.find((id) => !used.has(id));
  return free ? { kind: "create", gtmLeadId: free } : { kind: "none" };
}
