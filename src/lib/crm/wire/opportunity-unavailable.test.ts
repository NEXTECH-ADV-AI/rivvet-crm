import { test } from "node:test";
import assert from "node:assert/strict";
import { unavailableOpportunities } from "./opportunity-unavailable";
import { OPPS_UNAVAILABLE_TAG } from "../analytics";
import { seedOpportunities } from "../seed";

test("a failed live opportunities read is zero rows, flagged unavailable, with the tag the store reads", () => {
  const r = unavailableOpportunities(50, 0, "crm_opportunities 500");
  assert.equal(r.opportunities.length, 0);
  assert.equal(r.total, 0);
  assert.equal(r.unavailable, true);
  assert.ok(r.message.includes(OPPS_UNAVAILABLE_TAG));
  assert.ok(seedOpportunities.length > 0, "seed exists, so zero is a choice not an accident");
});
