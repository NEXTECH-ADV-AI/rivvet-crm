import type { Activity } from "../types";

const KNOWN_TYPES = new Set(["call", "email", "meeting", "task", "system", "note"]);

function relatedName(row: Record<string, unknown>, fallback: string): string {
  const acct = row.accounts as { name?: string } | null | undefined;
  const lead = row.gtm_leads as { business_name?: string } | null | undefined;
  const opp = row.crm_opportunities as { opportunity_name?: string } | null | undefined;
  return acct?.name || lead?.business_name || opp?.opportunity_name || fallback;
}

/** Lead pages are keyed `L-<first 8 of gtm_lead_id>` (gtm-lead-map). */
const leadRouteId = (id: string | null) => (id ? `L-${id.slice(0, 8)}` : null);

const CONVERSION_LABEL: Record<string, string> = {
  unsubscribe: "Unsubscribed from email",
  trial_requested: "Asked for a trial",
  trial_started: "Started a trial",
};

/** System subjects ("GTM conversion: unsubscribe (gtm_leads_suppression)") read in plain words. */
export function plainSubject(subject: string): string {
  const m = /^GTM conversion:\s*([a-z_]+)/i.exec(subject);
  if (!m) return subject;
  return CONVERSION_LABEL[m[1].toLowerCase()] ?? m[1].replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** `activities` rows are touches that already happened: history, never open
 *  work. The table has no status, title or due date (RIV-1534 pass). */
export function mapTouchRow(row: Record<string, unknown>): Activity {
  const typeRaw = String(row.type || "note").toLowerCase();
  const type = (KNOWN_TYPES.has(typeRaw) ? typeRaw : "note") as Activity["type"];
  const when = String(row.occurred_at || row.created_at || new Date().toISOString());
  const leadId = row.gtm_lead_id ? String(row.gtm_lead_id) : null;
  const accountId = row.account_id ? String(row.account_id) : null;
  const subject =
    plainSubject(String(row.subject || row.summary || "").trim()) ||
    `${type[0].toUpperCase()}${type.slice(1)}${row.direction ? ` (${row.direction})` : ""}`;
  return {
    id: String(row.activity_id),
    type,
    subject: subject.slice(0, 120),
    body: String(row.summary || ""),
    relatedType: accountId ? "account" : "lead",
    relatedId: accountId || leadRouteId(leadId) || String(row.activity_id),
    relatedName: relatedName(row, "Unknown business"),
    ownerId: "unassigned",
    dueAt: null,
    completedAt: when,
    createdAt: when,
  };
}

/** `crm_tasks` rows are the open work list (call-backs, follow-ups). */
export function mapTaskRow(row: Record<string, unknown>): Activity {
  const accountId = row.account_id ? String(row.account_id) : null;
  const leadId = row.gtm_lead_id ? String(row.gtm_lead_id) : null;
  const oppId = row.opportunity_id ? String(row.opportunity_id) : null;
  return {
    id: String(row.task_id),
    type: "task",
    subject: String(row.title || "Follow up").slice(0, 120),
    body: row.priority && row.priority !== "normal" ? `Priority: ${row.priority}` : "",
    relatedType: oppId ? "opportunity" : accountId ? "account" : "lead",
    relatedId: oppId || accountId || leadRouteId(leadId) || String(row.task_id),
    relatedName: relatedName(row, "Unknown business"),
    ownerId: "unassigned",
    dueAt: row.due_at ? String(row.due_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}
