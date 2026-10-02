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

/** Cell and VoIP numbers stay out of the call queue until a Do Not Call scrub clears them
 *  (RIV-1533): a sole owner's cell is a wireless number the national DNC list covers.
 *  Two sources say what a line is: the older `phone_type` column and Twilio's lookup in
 *  `enrichment_data.phone_line_type` (what the queue badge shows). Either one holds it. */
export const HELD_LINE_TYPES = {
  phone_type: ["mobile", "voip"],
  "enrichment_data->>phone_line_type": ["mobile", "fixedVoip", "nonFixedVoip"],
} as const;

/** PostgREST or-groups for the queue, one per source. A number a source has not checked
 *  stays (unchecked is not known to be a cell); `not.in` alone would also drop NULL rows. */
export const queueLineTypeFilters = () =>
  Object.entries(HELD_LINE_TYPES).map(([col, held]) => `(${col}.is.null,${col}.not.in.(${held.join(",")}))`);
