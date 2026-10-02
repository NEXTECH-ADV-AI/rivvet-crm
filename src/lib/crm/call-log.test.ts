import { test } from "node:test";
import assert from "node:assert/strict";
import { callLeadPatch, isCallOutcome, queueLineTypeFilters } from "./call-log";

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

test("the call queue holds back a number either source calls a cell or VoIP line, and keeps the rest", () => {
  const groups = queueLineTypeFilters();
  const held = (col: string) => {
    const g = groups.find((x) => x.startsWith(`(${col}.is.null,`));
    assert.ok(g, `${col} is checked, and its unchecked rows stay`);
    return new RegExp(`${col.replace(/[>-]/g, "\\$&")}\\.not\\.in\\.\\(([^)]*)\\)`).exec(g)![1].split(",").sort();
  };
  assert.deepEqual(held("phone_type"), ["mobile", "voip"]);
  assert.deepEqual(held("enrichment_data->>phone_line_type"), ["fixedVoip", "mobile", "nonFixedVoip"]);
  assert.ok(!groups.join().includes("landline"));
});
