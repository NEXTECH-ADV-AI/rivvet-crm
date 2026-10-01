import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeById, queueOpps } from "./filters";
import type { Opportunity } from "./types";

const old = new Date(Date.now() - 30 * 864e5).toISOString();
const opp = (id: string, over: Partial<Opportunity>): Opportunity =>
  ({ id, name: id, stage: "discovery", amount: 5000, ownerId: "unassigned", closeDate: null, nextAction: null, nextActionDue: null, lastTouch: old, stageEnteredAt: old, ...over }) as Opportunity;

test("Home deal queue includes unowned open deals and skips closed ones", () => {
  const ids = queueOpps([
    opp("unowned", {}),
    opp("won", { stage: "closed_won" }),
    opp("lost", { stage: "closed_lost" }),
  ]).map((o) => o.id);
  assert.deepEqual(ids, ["unowned"]);
});

test("mergeById keeps fresh records and adds the ones only kept had", () => {
  const out = mergeById([{ id: "a", v: 2 }], [{ id: "a", v: 1 }, { id: "b", v: 1 }]);
  assert.deepEqual(out, [{ id: "a", v: 2 }, { id: "b", v: 1 }]);
});
