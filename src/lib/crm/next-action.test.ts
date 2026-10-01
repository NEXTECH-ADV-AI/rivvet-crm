import { test } from "node:test";
import assert from "node:assert/strict";
import { leadIdRange, nextActionWrite } from "./next-action";

const open = { taskId: "t1", title: "Call back Tuesday", dueDate: "2026-10-06" };

test("a new next step inserts one task, due at noon UTC", () => {
  assert.deepEqual(nextActionWrite(null, { title: " Call back Tuesday ", dueDate: "2026-10-06" }), {
    kind: "insert",
    title: "Call back Tuesday",
    dueAt: "2026-10-06T12:00:00.000Z",
  });
});

test("editing updates the open task; clearing cancels it; no change writes nothing", () => {
  assert.deepEqual(nextActionWrite(open, { title: "Send quote", dueDate: null }), {
    kind: "update",
    taskId: "t1",
    title: "Send quote",
    dueAt: null,
  });
  assert.deepEqual(nextActionWrite(open, { title: "  ", dueDate: "2026-10-06" }), { kind: "cancel", taskId: "t1" });
  assert.deepEqual(nextActionWrite(open, { title: "Call back Tuesday", dueDate: "2026-10-06" }), { kind: "none" });
  assert.deepEqual(nextActionWrite(null, { title: "", dueDate: null }), { kind: "none" });
});

test("a lead link maps to exactly its uuid prefix range, junk maps to nothing", () => {
  assert.deepEqual(leadIdRange("L-2F1DFB20"), [
    "2f1dfb20-0000-0000-0000-000000000000",
    "2f1dfb20-ffff-ffff-ffff-ffffffffffff",
  ]);
  assert.equal(leadIdRange("L-1042"), null);
  assert.equal(leadIdRange("L-2f1dfb20&or=(x)"), null);
});
