/**
 * Create an Opportunity (RIV-1555). Create only: never touches contract, send, PandaDoc or Stripe.
 * No owner is assigned (founder, 2026-10-01); source_reference records who made it.
 */

import type { Opportunity } from "../types";
import {
  accountOpportunityPlan,
  type CreateOpportunityInput,
  type NewOppStage,
} from "../opportunity-create";
import { getServerSupabaseConfig, isLiveWire } from "./config";
import { getOpportunityService } from "./opportunity-service.server";

export type CreateOpportunityResult = {
  opportunityId: string;
  existing: boolean;
  opportunity: Opportunity | null;
};

class RestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getServerSupabaseConfig();
  const res = await fetch(`${url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new RestError(
      `${init?.method ?? "GET"} ${path.split("?")[0]} ${res.status}: ${body.slice(0, 160)}`,
      res.status,
    );
  }
  const body = await res.text();
  return (body ? JSON.parse(body) : null) as T;
}

async function oppForLead(gtmLeadId: string): Promise<string | null> {
  const [row] = await call<{ opportunity_id: string }[]>(
    `/crm_opportunities?select=opportunity_id&source_gtm_lead_id=eq.${gtmLeadId}&limit=1`,
  );
  return row?.opportunity_id ?? null;
}

type LeadRow = {
  business_name: string | null;
  owner_email: string | null;
  email_verified_address: string | null;
  general_email: string | null;
  demo_booked_at: string | null;
};

async function fromLead(
  gtmLeadId: string,
  repEmail: string,
  stage?: NewOppStage,
): Promise<{ id: string; existing: boolean }> {
  const had = await oppForLead(gtmLeadId);
  if (had) return { id: had, existing: true };
  const [lead] = await call<LeadRow[]>(
    `/gtm_leads?select=business_name,owner_email,email_verified_address,general_email,demo_booked_at&gtm_lead_id=eq.${gtmLeadId}&is_test=not.is.true&limit=1`,
  );
  if (!lead) throw new Error("Lead not found");

  // Same steps as the reply sweep: mark the lead, make or find its account, link its contact.
  await call(`/gtm_leads?gtm_lead_id=eq.${gtmLeadId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ opportunity_created: true }),
  });
  const accountId = await call<string>(`/rpc/convert_lead`, {
    method: "POST",
    body: JSON.stringify({ p_gtm_lead_id: gtmLeadId }),
  });
  const email =
    (lead.email_verified_address || lead.owner_email || lead.general_email || "").toLowerCase() ||
    null;
  const [contact] = await call<{ contact_id: string }[]>(
    `/contacts?select=contact_id&account_id=eq.${accountId}&gtm_lead_id=eq.${gtmLeadId}&order=is_primary.desc&limit=1`,
  );

  try {
    const [row] = await call<{ opportunity_id: string }[]>(
      `/crm_opportunities?select=opportunity_id`,
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          source_gtm_lead_id: gtmLeadId,
          account_id: accountId,
          primary_contact_id: contact?.contact_id ?? null,
          contact_email: email,
          opportunity_name: lead.business_name?.trim() || "Unnamed",
          stage: stage ?? (lead.demo_booked_at ? "demo_booked" : "qualified"),
          source: "manual",
          source_reference: `crm:${repEmail}`,
        }),
      },
    );
    return { id: row.opportunity_id, existing: false };
  } catch (e) {
    // Two clicks or the reply sweep got there first: the lead's one Opportunity already exists.
    const raced = e instanceof RestError && e.status === 409 ? await oppForLead(gtmLeadId) : null;
    if (raced) return { id: raced, existing: true };
    throw e;
  }
}

async function fromAccount(accountId: string, repEmail: string) {
  const [leads, opps] = await Promise.all([
    call<{ gtm_lead_id: string }[]>(
      `/gtm_leads?select=gtm_lead_id&account_id=eq.${accountId}&is_test=not.is.true&order=updated_at.desc&limit=50`,
    ),
    call<{ opportunity_id: string; stage: string; source_gtm_lead_id: string | null }[]>(
      `/crm_opportunities?select=opportunity_id,stage,source_gtm_lead_id&account_id=eq.${accountId}`,
    ),
  ]);
  const plan = accountOpportunityPlan(
    leads.map((l) => l.gtm_lead_id),
    opps,
  );
  if (plan.kind === "existing") return { id: plan.opportunityId, existing: true };
  if (plan.kind === "none")
    throw new Error("This account has no lead to start an Opportunity from.");
  return fromLead(plan.gtmLeadId, repEmail);
}

async function fromForm(input: Extract<CreateOpportunityInput, { from: "new" }>, repEmail: string) {
  if (input.email) {
    // A known email reuses its lead rather than making a duplicate company.
    const e = encodeURIComponent(input.email);
    const [match] = await call<{ gtm_lead_id: string }[]>(
      `/gtm_leads?select=gtm_lead_id&is_test=not.is.true&or=(owner_email.eq."${e}",email_verified_address.eq."${e}")&order=updated_at.desc&limit=1`,
    );
    if (match) return fromLead(match.gtm_lead_id, repEmail, input.stage);
  }
  const [row] = await call<{ opportunity_id: string }[]>(`/rpc/crm_create_opportunity`, {
    method: "POST",
    body: JSON.stringify({
      p_company_name: input.company,
      p_contact_name: input.contact,
      p_contact_email: input.email,
      p_phone: input.phone,
      p_stage: input.stage,
      // Left empty on purpose: the function would make the creator the lead's owner.
      p_created_by: null,
    }),
  });
  return { id: row.opportunity_id, existing: false };
}

export async function createOpportunityService(
  input: CreateOpportunityInput,
  repEmail: string,
): Promise<CreateOpportunityResult> {
  if (!isLiveWire()) throw new Error("Not connected to live data.");
  const made =
    input.from === "lead"
      ? await fromLead(input.gtmLeadId, repEmail)
      : input.from === "account"
        ? await fromAccount(input.accountId, repEmail)
        : await fromForm(input, repEmail);
  const { opportunity } = await getOpportunityService(made.id);
  return { opportunityId: made.id, existing: made.existing, opportunity };
}
