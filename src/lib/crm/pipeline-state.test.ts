import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, pipelineKpiDisplay, pipelineState } from "./analytics";
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

describe("pipelineKpiDisplay (RIV-1940)", () => {
  const zero = { pipeline: 0, weighted: 0, closing30Amt: 0, closing30Count: 0 };

  test("an empty pipeline renders no dollar figure on any money KPI", () => {
    const d = pipelineKpiDisplay("empty", zero);
    for (const v of [d.pipeline, d.weighted, d.closing]) {
      assert.equal(v, "None yet");
      assert.doesNotMatch(v, /\$|\d/);
    }
    assert.equal(d.closingSub, undefined);
  });

  test("loading and unavailable render their own states, not dollars", () => {
    const l = pipelineKpiDisplay("loading", zero);
    assert.deepEqual([l.pipeline, l.weighted, l.closing], ["…", "…", "…"]);
    const u = pipelineKpiDisplay("unavailable", zero);
    assert.deepEqual([u.pipeline, u.weighted, u.closing], ["Unavailable", "Unavailable", "Unavailable"]);
  });

  test("a ready pipeline renders formatted money and the closing count", () => {
    const d = pipelineKpiDisplay("ready", {
      pipeline: 12000,
      weighted: 6000,
      closing30Amt: 3000,
      closing30Count: 1,
    });
    assert.equal(d.pipeline, formatMoney(12000));
    assert.equal(d.weighted, formatMoney(6000));
    assert.equal(d.closing, formatMoney(3000));
    assert.equal(d.closingSub, "1 opportunity");
  });
});
