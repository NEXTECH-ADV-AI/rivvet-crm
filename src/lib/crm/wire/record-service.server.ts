import { randomUUID } from "node:crypto";
import { seedLeads } from "../seed";
import type { Activity, Lead } from "../types";
import { leadIdRange, NEXT_ACTION_SOURCE, nextActionWrite, type NextActionTask } from "../next-action";
import { getServerSupabaseConfig, isLiveWire } from "./config";
import { mapGtmLeadRow, type GtmLeadRow } from "./gtm-lead-map";
import { mapTaskRow, mapTouchRow } from "./activity-map";

/** One record's lead or account scope. Exactly one id is set (validated in server-fns). */
export type RecordTarget = { gtmLeadId?: string; accountId?: string };

function rest() {
  const { url, key } = getServerSupabaseConfig();
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${url}/rest/v1${path}`, { ...init, headers: { ...headers, ...init?.headers } });
    if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path.split("?")[0]} ${res.status}`);
    return (res.status === 204 || init?.method === "PATCH" || init?.method === "POST" ? null : await res.json()) as T;
  };
}

const scope = (t: RecordTarget) =>
  t.gtmLeadId ? `gtm_lead_id=eq.${t.gtmLeadId}` : `account_id=eq.${t.accountId}`;

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
    get<Record<string, unknown>[]>(`/crm_tasks?select=*&${scope(t)}&status=eq.open&is_test=is.false&order=due_at.asc.nullslast&limit=20`),
    get<Record<string, unknown>[]>(
      `/activities?select=activity_id,account_id,gtm_lead_id,type,direction,subject,summary,occurred_at,created_at&${scope(t)}&order=occurred_at.desc&limit=20`,
    ),
  ]);
  // Tie every row to this page, even when a lead's row also carries its account id.
  const relatedType = t.gtmLeadId ? ("lead" as const) : ("account" as const);
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
    // No assigned rep on purpose: leads are not given owners (founder, 2026-10-01).
    await send(`/crm_tasks`, {
      method: "POST",
      headers: minimal,
      body: JSON.stringify({
        gtm_lead_id: t.gtmLeadId ?? null,
        account_id: t.accountId ?? null,
        title: write.title,
        due_at: write.dueAt,
        source: NEXT_ACTION_SOURCE,
      }),
    });
  }
  return { ok: true };
}

/** A manual history entry (an email sent, an account call), exactly-once on source + source_ref. */
export async function logTouchService(
  t: RecordTarget,
  input: { type: "call" | "email"; note: string; repEmail: string },
): Promise<{ ok: true }> {
  await rest()(`/activities`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      gtm_lead_id: t.gtmLeadId ?? null,
      account_id: t.accountId ?? null,
      type: input.type,
      channel: input.type,
      direction: "outbound",
      subject: input.type === "call" ? "Call logged" : "Email logged",
      summary: input.note || null,
      occurred_at: new Date().toISOString(),
      source: "crm_manual_log",
      source_ref: randomUUID(),
      payload: { rep: input.repEmail },
    }),
  });
  return { ok: true };
}
