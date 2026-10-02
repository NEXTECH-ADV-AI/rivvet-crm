/** Call outcomes a rep can log from the call queue (RIV-1537). Pure: no I/O. */
export const CALL_OUTCOMES = [
  { id: "no_answer", label: "No answer" },
  { id: "voicemail", label: "Left voicemail" },
  { id: "callback", label: "Call back later" },
  { id: "not_interested", label: "Not interested" },
  { id: "demo_booked", label: "Booked a demo" },
  { id: "wrong_number", label: "Wrong number" },
  { id: "do_not_call", label: "Do not call" },
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number]["id"];

export const isCallOutcome = (v: unknown): v is CallOutcome =>
  CALL_OUTCOMES.some((o) => o.id === v);

/** The gtm_leads fields one logged call changes. A call-back returns the lead to
 *  the queue on that date; "do not call" sets the DNC flag so it never returns. */
export function callLeadPatch(input: {
  outcome: CallOutcome;
  priorHumanAttempts: number;
  repEmail: string;
  nowIso: string;
  callbackAt?: string | null;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    human_call_attempts: Math.max(0, input.priorHumanAttempts) + 1,
    last_human_call_at: input.nowIso,
    call_outcome: input.outcome,
    call_owner: input.repEmail,
    next_callback_at: input.outcome === "callback" ? (input.callbackAt ?? null) : null,
  };
  if (input.outcome === "do_not_call") patch.dnc_flag = true;
  return patch;
}
