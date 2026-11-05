import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { pipelineState } from "./analytics";
import { seedOpportunities } from "./seed";

describe("pipelineState (RIV-1940)", () => {
  test("before the first hydrate it is loading", () => {
    assert.equal(
      pipelineState({ opportunities: [], hydratedAt: null, unavailable: false }),
      "loading",
    );
  });
  test("a failed read is unavailable, even with no rows", () => {
    assert.equal(
      pipelineState({ opportunities: [], hydratedAt: "t", unavailable: true }),
      "unavailable",
    );
  });
  test("hydrated with zero opportunities is empty, not zero dollars of pipeline", () => {
    assert.equal(
      pipelineState({ opportunities: [], hydratedAt: "t", unavailable: false }),
      "empty",
    );
  });
  test("hydrated with rows is ready", () => {
    assert.equal(
      pipelineState({
        opportunities: [seedOpportunities[0]],
        hydratedAt: "t",
        unavailable: false,
      }),
      "ready",
    );
  });
});
