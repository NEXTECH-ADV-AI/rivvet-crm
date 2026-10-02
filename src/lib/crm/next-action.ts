/** A record's next step is one open crm_task with this source (RIV-1542).
 *  gtm_leads and accounts have no next_action columns, so it lives where the
 *  rest of the open work does and shows on the Activities page too. */
export const NEXT_ACTION_SOURCE = "crm_next_action";

export type NextActionTask = { taskId: string; title: string; dueDate: string | null };

export type NextActionWrite =
  | { kind: "none" }
  | { kind: "cancel"; taskId: string }
  | { kind: "update"; taskId: string; title: string; dueAt: string | null }
  | { kind: "insert"; title: string; dueAt: string | null };

/** `YYYY-MM-DD` from the date input, stored at noon UTC so no US time zone shifts the day. */
export function dueDateToIso(date: string | null): string | null {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00.000Z` : null;
}

export function nextActionWrite(
  existing: NextActionTask | null,
  input: { title: string | null; dueDate: string | null },
): NextActionWrite {
  const title = input.title?.trim().slice(0, 200) || null;
  const dueAt = dueDateToIso(input.dueDate);
  if (!title) return existing ? { kind: "cancel", taskId: existing.taskId } : { kind: "none" };
  if (!existing) return { kind: "insert", title, dueAt };
  if (existing.title === title && dueDateToIso(existing.dueDate) === dueAt) return { kind: "none" };
  return { kind: "update", taskId: existing.taskId, title, dueAt };
}

/** Puts each opportunity's newest open next step (tasks arrive newest first) on it. */
export function attachNextSteps<O extends { id: string; nextAction: string | null; nextActionDue: string | null }>(
  opps: O[],
  tasks: { opportunity_id: string; title: string; due_at: string | null }[],
): O[] {
  const next = new Map<string, (typeof tasks)[number]>();
  for (const t of tasks) if (!next.has(t.opportunity_id)) next.set(t.opportunity_id, t);
  return opps.map((o) => {
    const t = next.get(o.id);
    return t ? { ...o, nextAction: t.title, nextActionDue: t.due_at?.slice(0, 10) ?? null } : o;
  });
}

/** Lead pages are keyed `L-<first 8 hex of gtm_lead_id>`; this is the uuid range
 *  that prefix covers, so a direct link can find its lead. */
export function leadIdRange(routeId: string): [string, string] | null {
  const m = /^L-([0-9a-f]{8})$/i.exec(routeId);
  if (!m) return null;
  const p = m[1].toLowerCase();
  return [`${p}-0000-0000-0000-000000000000`, `${p}-ffff-ffff-ffff-ffffffffffff`];
}
