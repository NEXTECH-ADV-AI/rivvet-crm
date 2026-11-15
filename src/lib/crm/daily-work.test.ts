import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDailyWork, dueState, isInternalActivity } from "./daily-work";
import { buildGtmAnalytics, pipelineKpiDisplay } from "./analytics";
import { mapOpportunityRow } from "./wire/opportunity-map";
import { seedAccounts, seedActivities, seedLeads } from "./seed";

const now = new Date(2026, 10, 13, 9).getTime();
const opp = (id: string, fields: Record<string, unknown> = {}) =>
  mapOpportunityRow({
    opportunity_id: id,
    opportunity_name: id,
    stage: "qualified",
    created_at: "2026-11-10T12:00:00Z",
    updated_at: "2026-11-10T12:00:00Z",
    ...fields,
  });

test("missing pricing stays distinguishable from an explicit zero without changing numeric contracts", () => {
  const missing = opp("missing", { amount: null });
  const zero = opp("zero", { amount: 0 });
  assert.equal(missing.amount, 0);
  assert.equal(missing.amountKnown, false);
  assert.equal(zero.amountKnown, true);
  const data = buildGtmAnalytics([missing], [], [], [], null, { now });
  assert.equal(pipelineKpiDisplay("ready", data.kpis).pipeline, "Not priced");
  assert.equal(
    pipelineKpiDisplay("ready", buildGtmAnalytics([zero], [], [], []).kpis).pipeline,
    "$0",
  );
});

test("open pipeline excludes closed-won and past-due closes from next 30 days", () => {
  const data = buildGtmAnalytics(
    [
      opp("open", { amount: 5000, expected_close_date: "2026-11-20" }),
      opp("past", { amount: 7000, expected_close_date: "2026-10-01" }),
      opp("won", { stage: "closed_won", amount: 9000 }),
    ],
    [],
    [],
    [],
    null,
    { now },
  );
  assert.equal(data.kpis.pipeline, 12000);
  assert.equal(data.kpis.closing30Amt, 5000);
  assert.equal(
    data.byStage.some((s) => (s.stage as string) === "closed_won"),
    false,
  );
  assert.equal(data.kpis.wonYtd, 9000);
});

test("30 day filter uses creation dates; won totals do not pretend edits were conversions", () => {
  const oldWon = opp("old", {
    stage: "closed_won",
    created_at: "2026-01-01T12:00:00Z",
    updated_at: "2026-11-12T12:00:00Z",
  });
  const data = buildGtmAnalytics(
    [oldWon, opp("new")],
    [{ ...seedLeads[0], source: "inbound_partner", createdAt: "2026-11-10T12:00:00Z" }],
    [],
    [],
    null,
    { now, period: "30d" },
  );
  assert.equal(data.period.created, 1);
  assert.equal(data.period.won, 1);
  assert.equal(
    data.sourceMix.reduce((sum, row) => sum + row.value, 0),
    1,
  );
  assert.equal(
    data.weekly.reduce((sum, row) => sum + row.won, 0),
    0,
  );
});

test("daily work ranks overdue tasks before missing next steps and excludes closed deals", () => {
  const task = {
    ...seedActivities[0],
    id: "task",
    type: "task" as const,
    relatedType: "opportunity" as const,
    relatedId: "task-opp",
    relatedName: "Customer",
    completedAt: null,
    dueAt: "2026-11-12T12:00:00Z",
  };
  const items = buildDailyWork(
    [opp("missing"), opp("task-opp"), opp("won", { stage: "closed_won" })],
    [],
    [task],
    now,
  );
  assert.equal(items[0].id, "task:task");
  assert.equal(items[0].state, "overdue");
  assert.equal(items.filter((item) => item.record === "task-opp").length, 0);
  assert.equal(
    items.some((item) => item.id === "opp:won"),
    false,
  );
  assert.equal(dueState("2026-11-13", now), "today");
  assert.equal(dueState("not-a-date", now), "unscheduled");
});

test("customer followup never claims a missing step after a failed lookup", () => {
  const account = {
    ...seedAccounts[0],
    status: "customer" as const,
    lifecycleStage: "customer" as const,
    nextActionKnown: false,
    nextAction: null,
    isTest: false,
  };
  const item = buildDailyWork([], [account], [], now)[0];
  assert.equal(item.title, "Check customer follow-up");
  assert.equal(item.reason, "Next step could not be verified");
});

test("activity view excludes only explicit test/system markers and leaves customer words untouched", () => {
  const base = {
    ...seedActivities[0],
    type: "email" as const,
    relatedName: "Customer",
    subject: "QA question about testing",
  };
  assert.equal(isInternalActivity(base), false);
  assert.equal(isInternalActivity({ ...base, relatedName: "Rivvet Test Shop" }), true);
  assert.equal(isInternalActivity({ ...base, type: "system" }), true);
  assert.equal(isInternalActivity({ ...base, isTest: true }), true);
});
