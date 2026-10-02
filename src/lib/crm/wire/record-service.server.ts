import { randomUUID } from "node:crypto";
import { seedLeads } from "../seed";
import type { Activity, Lead } from "../types";
import { leadIdRange, NEXT_ACTION_SOURCE, nextActionWrite, type NextActionTask } from "../next-action";
import { getServerSupabaseConfig, isLiveWire } from "./config";
import { mapGtmLeadRow, type GtmLeadRow } from "./gtm-lead-map";
import { mapTaskRow, mapTouchRow } from "./activity-map";
import { mapOpportunityRow, type ProdOppRow } from "./opportunity-map";
import { pickContactId, type OpportunityForm } from "../opportunity-form";

/** One record's lead, account or opportunity scope. Exactly one id is set (validated in server-fns). */
export type RecordTarget = { gtmLeadId?: string; accountId?: string; opportunityId?: string };

function rest() {
  const { url, key } = getServerSupabaseConfig();
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${url}/rest/v1${path}`, { ...init, headers: { ...headers, ...init?.headers } });
    if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path.split("?")[0]} ${res.status}`);
    const body = await res.text();
    return (body ? JSON.parse(body) : null) as T;
  };
}

/** crm_tasks scope. An opportunity's tasks carry only opportunity_id, so they never become the account's next step. */
const scope = (t: RecordTarget) =>
  t.opportunityId
    ? `opportunity_id=eq.${t.opportunityId}`
    : t.gtmLeadId
      ? `gtm_lead_id=eq.${t.gtmLeadId}`
      : `account_id=eq.${t.accountId}`;

/** activities has no opportunity column: an opportunity's notes and logs carry it in payload. */
const historyScope = (t: RecordTarget) =>
  t.opportunityId ? `payload->>opportunity_id=eq.${t.opportunityId}` : scope(t);

type OppRef = {
  opportunity_id: string;
  account_id: string | null;
  source_gtm_lead_id: string | null;
  primary_contact_id: string | null;
  is_test: boolean;
  test_reason: string | null;
};

async function oppRef(opportunityId: string): Promise<OppRef> {
  const [row] = await rest()<OppRef[]>(
    `/crm_opportunities?select=opportunity_id,account_id,source_gtm_lead_id,primary_contact_id,is_test,test_reason&opportunity_id=eq.${opportunityId}&limit=1`,
  );
  if (!row) throw new Error("Opportunity not found");
  return row;
}

/** A lead by its page id, straight from gtm_leads, so a pasted link works (RIV-1542). */
export async function getLeadService(routeId: string): Promise<{ lead: Lead | null }> {
  if (!isLiveWire()) return { lead: seedLeads.find((l) => l.id === routeId) ?? null };
  const range = leadIdRange(routeId);
  if (!range) return { lead: null };
  const rows = await rest()<GtmLeadRow[]>(
    `/gtm_leads?select=*&is_test=not.is.true&gtm_lead_id=gte.${range[0]}&gtm_lead_id=lte.${range[1]}&limit=2`,
  );
  // Two leads sharing an 8-character prefix: refuse rather than open the wrong one.
  return { lead: rows.length === 1 ? mapGtmLeadRow(rows[0]) : null };
}

/** Open tasks and history for one record, newest first. */
export async function getRecordActivitiesService(t: RecordTarget, routeId: string): Promise<{ activities: Activity[] }> {
  if (!isLiveWire()) return { activities: [] };
  const get = rest();
  const [tasks, touches] = await Promise.all([
    // A test opportunity's own tasks are test rows too; its page still shows them.
    get<Record<string, unknown>[]>(
      `/crm_tasks?select=*&${scope(t)}&status=eq.open${t.opportunityId ? "" : "&is_test=is.false"}&order=due_at.asc.nullslast&limit=20`,
    ),
    get<Record<string, unknown>[]>(
      `/activities?select=activity_id,account_id,gtm_lead_id,type,direction,subject,summary,occurred_at,created_at&${historyScope(t)}&order=occurred_at.desc&limit=20`,
    ),
  ]);
  // Tie every row to this page, even when a lead's row also carries its account id.
  const relatedType = t.opportunityId ? ("opportunity" as const) : t.gtmLeadId ? ("lead" as const) : ("account" as const);
  return {
    activities: [...tasks.map(mapTaskRow), ...touches.map(mapTouchRow)].map((a) => ({ ...a, relatedType, relatedId: routeId })),
  };
}

async function openNextAction(t: RecordTarget): Promise<NextActionTask | null> {
  const [row] = await rest()<{ task_id: string; title: string; due_at: string | null }[]>(
    `/crm_tasks?select=task_id,title,due_at&${scope(t)}&status=eq.open&source=eq.${NEXT_ACTION_SOURCE}&order=created_at.desc&limit=1`,
  );
  return row ? { taskId: row.task_id, title: row.title, dueDate: row.due_at?.slice(0, 10) ?? null } : null;
}

export async function getNextActionService(t: RecordTarget): Promise<{ nextAction: NextActionTask | null }> {
  return { nextAction: isLiveWire() ? await openNextAction(t) : null };
}

export async function setNextActionService(
  t: RecordTarget,
  input: { title: string | null; dueDate: string | null },
): Promise<{ ok: true }> {
  const write = nextActionWrite(await openNextAction(t), input);
  const send = rest();
  const now = new Date().toISOString();
  const minimal = { Prefer: "return=minimal" };
  if (write.kind === "cancel") {
    await send(`/crm_tasks?task_id=eq.${write.taskId}&status=eq.open`, {
      method: "PATCH",
      headers: minimal,
      body: JSON.stringify({ status: "cancelled", updated_at: now }),
    });
  } else if (write.kind === "update") {
    await send(`/crm_tasks?task_id=eq.${write.taskId}&status=eq.open`, {
      method: "PATCH",
      headers: minimal,
      body: JSON.stringify({ title: write.title, due_at: write.dueAt, updated_at: now }),
    });
  } else if (write.kind === "insert") {
    // A test opportunity's task is a test row, so it stays off the real Activities list.
    const opp = t.opportunityId ? await oppRef(t.opportunityId) : null;
    // No assigned rep on purpose: leads are not given owners (founder, 2026-10-01).
    await send(`/crm_tasks`, {
      method: "POST",
      headers: minimal,
      body: JSON.stringify({
        gtm_lead_id: t.gtmLeadId ?? null,
        account_id: t.accountId ?? null,
        opportunity_id: t.opportunityId ?? null,
        title: write.title,
        due_at: write.dueAt,
        source: NEXT_ACTION_SOURCE,
        ...(opp?.is_test ? { is_test: true, test_reason: opp.test_reason || "test opportunity" } : {}),
      }),
    });
  }
  return { ok: true };
}

const TOUCH_SUBJECT = { call: "Call logged", email: "Email logged", note: "Note" } as const;

/** A manual history entry (an email sent, a call, a note), exactly-once on source + source_ref.
 *  An opportunity's entry also lands on its account and lead timelines. */
export async function logTouchService(
  t: RecordTarget,
  input: { type: "call" | "email" | "note"; note: string; repEmail: string },
): Promise<{ ok: true }> {
  const opp = t.opportunityId ? await oppRef(t.opportunityId) : null;
  await rest()(`/activities`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      gtm_lead_id: opp ? opp.source_gtm_lead_id : (t.gtmLeadId ?? null),
      account_id: opp ? opp.account_id : (t.accountId ?? null),
      type: input.type,
      channel: input.type === "note" ? null : input.type,
      direction: input.type === "note" ? null : "outbound",
      subject: TOUCH_SUBJECT[input.type],
      summary: input.note || null,
      occurred_at: new Date().toISOString(),
      source: "crm_manual_log",
      source_ref: randomUUID(),
      payload: opp ? { rep: input.repEmail, opportunity_id: opp.opportunity_id } : { rep: input.repEmail },
    }),
  });
  return { ok: true };
}

const OPP_SELECT =
  "opportunity_id,source_gtm_lead_id,legacy_deal_id,account_id,primary_contact_id,contact_email,opportunity_name,stage,amount,expected_close_date,assigned_rep_email,source,created_at,updated_at,is_test,test_reason,accounts(name,vertical,primary_contact_id)";

type ContactRow = { contact_id: string; name: string | null; email: string | null; phone: string | null; is_primary: boolean };
type OppRow = ProdOppRow & {
  opportunity_id: string;
  account_id: string | null;
  primary_contact_id: string | null;
  contact_email: string | null;
  opportunity_name: string;
  amount: number | string | null;
  expected_close_date: string | null;
  accounts: { name: string; vertical: string | null; primary_contact_id: string | null } | null;
};

async function findContact(row: OppRow): Promise<ContactRow | null> {
  const get = rest();
  const cols = "contact_id,name,email,phone,is_primary";
  const listed = row.account_id
    ? await get<ContactRow[]>(`/contacts?select=${cols}&account_id=eq.${row.account_id}&order=is_primary.desc,created_at.asc&limit=20`)
    : [];
  const id = pickContactId(row.primary_contact_id, row.accounts?.primary_contact_id ?? null, listed);
  if (!id) return null;
  return listed.find((c) => c.contact_id === id) ?? (await get<ContactRow[]>(`/contacts?select=${cols}&contact_id=eq.${id}`))[0] ?? null;
}

export type OpportunityRecord = {
  opportunity: ReturnType<typeof mapOpportunityRow>;
  form: OpportunityForm;
  hasAccount: boolean;
  isTest: boolean;
};

/** One opportunity by id, straight from the database, so a pasted link works before the app loads (RIV-1558). */
export async function getOpportunityRecordService(opportunityId: string): Promise<{ record: OpportunityRecord | null }> {
  if (!isLiveWire()) return { record: null };
  const [row] = await rest()<OppRow[]>(`/crm_opportunities?select=${OPP_SELECT}&opportunity_id=eq.${opportunityId}&limit=1`);
  if (!row) return { record: null };
  const [contact, next] = await Promise.all([findContact(row), openNextAction({ opportunityId })]);
  return {
    record: {
      opportunity: { ...mapOpportunityRow(row), nextAction: next?.title ?? null, nextActionDue: next?.dueDate ?? null },
      hasAccount: Boolean(row.account_id),
      isTest: row.is_test === true,
      form: {
        name: row.opportunity_name,
        amount: row.amount == null ? null : Number(row.amount),
        closeDate: row.expected_close_date?.slice(0, 10) ?? null,
        company: row.accounts?.name ?? "",
        vertical: row.accounts?.vertical ?? "",
        contactName: contact?.name ?? "",
        contactEmail: contact?.email ?? row.contact_email ?? "",
        contactPhone: contact?.phone ?? "",
        nextStep: next?.title ?? "",
        nextStepDue: next?.dueDate ?? null,
      },
    },
  };
}

/** Saves every field to the table it belongs to, then returns the stored row read back.
 *  ponytail: sequential PATCHes, not one transaction; a mid-way failure throws and the
 *  reload shows what landed. Move to an RPC if partial saves ever bite. */
export async function saveOpportunityService(opportunityId: string, form: OpportunityForm): Promise<{ record: OpportunityRecord }> {
  if (!isLiveWire()) throw new Error("Saving needs the live CRM");
  const send = rest();
  const now = new Date().toISOString();
  const minimal = { Prefer: "return=minimal" };
  const [row] = await send<OppRow[]>(`/crm_opportunities?select=${OPP_SELECT}&opportunity_id=eq.${opportunityId}&limit=1`);
  if (!row) throw new Error("Opportunity not found");

  if (row.account_id) {
    if (!form.company) throw new Error("Company can't be blank");
    await send(`/accounts?account_id=eq.${row.account_id}`, {
      method: "PATCH",
      headers: minimal,
      body: JSON.stringify({ name: form.company, vertical: form.vertical || null, updated_at: now }),
    });
  }

  const contact = await findContact(row);
  const contactFields = { name: form.contactName || null, email: form.contactEmail || null, phone: form.contactPhone || null };
  let contactId = contact?.contact_id ?? null;
  if (contactId) {
    await send(`/contacts?contact_id=eq.${contactId}`, {
      method: "PATCH",
      headers: minimal,
      body: JSON.stringify({ ...contactFields, updated_at: now }),
    });
  } else if (row.account_id && (form.contactName || form.contactEmail || form.contactPhone)) {
    const [made] = await send<{ contact_id: string }[]>(`/contacts?select=contact_id`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...contactFields, account_id: row.account_id, is_primary: true, source: "crm_manual" }),
    });
    contactId = made.contact_id;
  }

  await send(`/crm_opportunities?opportunity_id=eq.${opportunityId}`, {
    method: "PATCH",
    headers: minimal,
    body: JSON.stringify({
      opportunity_name: form.name,
      amount: form.amount,
      expected_close_date: form.closeDate,
      contact_email: form.contactEmail || null,
      primary_contact_id: contactId,
      updated_at: now,
    }),
  });
  await setNextActionService({ opportunityId }, { title: form.nextStep || null, dueDate: form.nextStepDue });

  const { record } = await getOpportunityRecordService(opportunityId);
  if (!record) throw new Error("Saved, but the opportunity didn't read back");
  return { record };
}
