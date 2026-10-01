import { test } from "node:test";
import assert from "node:assert/strict";
import { mapOpportunityRow, type ProdOppRow } from "./opportunity-map";

const row = (amount: number | null, stage = "qualified") =>
  ({ opportunity_id: "o1", opportunity_name: "Hillside HVAC", stage, amount, updated_at: "2026-10-01T00:00:00Z" }) as ProdOppRow;

test("an opportunity with no amount shows $0, not a made-up price", () => {
  for (const stage of ["qualified", "demo_booked", "closed_won"]) {
    const o = mapOpportunityRow(row(null, stage));
    assert.equal(o.amount, 0, stage);
    assert.equal(o.monthlyAmount, 0, stage);
  }
});

test("a real amount still shows: small values are monthly, large are contract value", () => {
  assert.equal(mapOpportunityRow(row(750)).monthlyAmount, 750);
  assert.equal(mapOpportunityRow(row(12000)).amount, 12000);
});
