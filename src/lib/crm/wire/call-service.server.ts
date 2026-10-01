import { randomUUID } from "node:crypto";
import { CALL_OUTCOMES, callLeadPatch, isCallOutcome } from "../call-log";
import { getServerSupabaseConfig } from "./config";

/** Log one hand-dialed call: update the lead's call fields and add one activities row
 *  (exactly-once on source + source_ref). RIV-1537. */
export async function logCallService(input: {
  gtmLeadId: string;
  outcome: string;
  note: string;
  callbackAt: string | null;
  repEmail: string;
}): Promise<{ ok: true }> {
  if (!isCallOutcome(input.outcome)) throw new Error("Unknown call outcome");
  if (input.outcome === "callback" && !input.callbackAt) throw new Error("Pick a call-back time");
  const { url, key } = getServerSupabaseConfig();
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const leadRes = await fetch(
    `${url}/rest/v1/gtm_leads?gtm_lead_id=eq.${input.gtmLeadId}&select=gtm_lead_id,account_id,human_call_attempts`,
    { headers: h },
  );
  const [lead] = (leadRes.ok ? await leadRes.json() : []) as {
    account_id: string | null;
    human_call_attempts: number | null;
  }[];
  if (!lead) throw new Error("Lead not found");

  const now = new Date().toISOString();
  const patch = callLeadPatch({
    outcome: input.outcome,
    priorHumanAttempts: lead.human_call_attempts ?? 0,
    repEmail: input.repEmail,
    nowIso: now,
    callbackAt: input.callbackAt,
  });
  const p = await fetch(`${url}/rest/v1/gtm_leads?gtm_lead_id=eq.${input.gtmLeadId}`, {
    method: "PATCH",
    headers: { ...h, Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!p.ok) throw new Error(`Couldn't save the call (${p.status})`);

  const label = CALL_OUTCOMES.find((o) => o.id === input.outcome)?.label ?? input.outcome;
  const a = await fetch(`${url}/rest/v1/activities`, {
    method: "POST",
    headers: { ...h, Prefer: "return=minimal" },
    body: JSON.stringify({
      account_id: lead.account_id,
      gtm_lead_id: input.gtmLeadId,
      type: "call",
      channel: "call",
      direction: "outbound",
      subject: `Call: ${label}`,
      summary: input.note || null,
      occurred_at: now,
      source: "crm_call_log",
      source_ref: randomUUID(),
      payload: { outcome: input.outcome, rep: input.repEmail, callback_at: input.callbackAt },
    }),
  });
  if (!a.ok) throw new Error(`Saved the call, but not its history row (${a.status})`);
  return { ok: true };
}
