import { test } from "node:test";
import assert from "node:assert/strict";
import { callLeadPatch, isCallOutcome, queueLineTypeFilter } from "./call-log";

const base = { priorHumanAttempts: 0, repEmail: "will@rivvetai.com", nowIso: "2026-10-01T16:00:00Z" };

test("a logged call counts the attempt and records who and how it went", () => {
  assert.deepEqual(callLeadPatch({ ...base, outcome: "no_answer" }), {
    human_call_attempts: 1,
    last_human_call_at: "2026-10-01T16:00:00Z",
    call_outcome: "no_answer",
    call_owner: "will@rivvetai.com",
    next_callback_at: null,
  });
});

test("only a call-back keeps a return date; do-not-call sets the DNC flag", () => {
  const cb = callLeadPatch({ ...base, outcome: "callback", callbackAt: "2026-10-03T16:00:00Z" });
  assert.equal(cb.next_callback_at, "2026-10-03T16:00:00Z");
  const vm = callLeadPatch({ ...base, outcome: "voicemail", callbackAt: "2026-10-03T16:00:00Z" });
  assert.equal(vm.next_callback_at, null);
  assert.equal(callLeadPatch({ ...base, outcome: "do_not_call" }).dnc_flag, true);
  assert.equal("dnc_flag" in callLeadPatch({ ...base, outcome: "not_interested" }), false);
  assert.equal(callLeadPatch({ ...base, priorHumanAttempts: 2, outcome: "no_answer" }).human_call_attempts, 3);
});

test("only known outcomes are accepted", () => {
  assert.equal(isCallOutcome("voicemail"), true);
  assert.equal(isCallOutcome("drop table"), false);
});

test("the call queue holds cell and VoIP numbers back but keeps unchecked and landline ones", () => {
  const f = queueLineTypeFilter();
  const held = /phone_type\.not\.in\.\(([^)]*)\)/.exec(f)?.[1].split(",") ?? [];
  assert.deepEqual(held.sort(), ["mobile", "voip"]);
  assert.ok(f.includes("phone_type.is.null"), "numbers with no line type yet stay in the queue");
  assert.ok(!held.includes("landline"));
});
