import { test } from "node:test";
import assert from "node:assert/strict";
import { mapTaskRow, mapTouchRow, plainSubject } from "./activity-map";

test("a past touch is history, never an overdue open item", () => {
  const a = mapTouchRow({
    activity_id: "a1",
    type: "call",
    gtm_lead_id: "5f0c2d1e-0000-4000-8000-000000000001",
    occurred_at: "2026-06-05T10:00:00Z",
    accounts: { name: "Desert Air LLC" },
  });
  assert.equal(a.completedAt, "2026-06-05T10:00:00Z");
  assert.equal(a.dueAt, null);
  assert.equal(a.subject, "Call");
  assert.equal(a.relatedName, "Desert Air LLC");
  assert.equal(a.relatedId, "L-5f0c2d1e");
});

test("a crm_tasks row is an open task with its own title and due date", () => {
  const t = mapTaskRow({
    task_id: "t1",
    title: "Call back Mesa Plumbing",
    priority: "urgent",
    due_at: "2026-10-01T18:00:00Z",
    created_at: "2026-10-01T17:00:00Z",
    gtm_leads: { business_name: "Mesa Plumbing" },
  });
  assert.equal(t.type, "task");
  assert.equal(t.completedAt, null);
  assert.equal(t.dueAt, "2026-10-01T18:00:00Z");
  assert.equal(t.relatedName, "Mesa Plumbing");
  assert.equal(t.body, "Priority: urgent");
});

test("system conversion subjects read in plain words; others pass through", () => {
  assert.equal(plainSubject("GTM conversion: unsubscribe (gtm_leads_suppression)"), "Unsubscribed from email");
  assert.equal(plainSubject("GTM conversion: trial_started (trial_signups)"), "Started a trial");
  assert.equal(plainSubject("GTM conversion: demo_booked (x)"), "Demo booked");
  assert.equal(plainSubject("Call logged"), "Call logged");
});
