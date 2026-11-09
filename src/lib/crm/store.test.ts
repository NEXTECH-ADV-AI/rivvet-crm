import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { seedOpportunities } from "./seed";
import { useCrmStore, OPPS_UNAVAILABLE_TAG } from "./store";

const emptyLive = {
  source: "live" as const,
  leads: [],
  accounts: [],
  opportunities: [],
  contacts: [],
  activities: [],
  message: "Hydrated LIVE",
};

describe("crm store opportunities (RIV-1940)", () => {
  beforeEach(() => {
    useCrmStore.setState({
      opportunities: [],
      opportunitiesUnavailable: false,
      hydratedAt: null,
    });
  });

  test("a fresh store holds no seed opportunities", () => {
    const fresh = useCrmStore.getInitialState();
    assert.equal(fresh.opportunities.length, 0);
    assert.equal(fresh.hydratedAt, null);
  });

  test("an empty live payload yields zero opportunities, never the seed rows", () => {
    useCrmStore.setState({ opportunities: structuredClone(seedOpportunities) });
    useCrmStore.getState().hydrateFromWire(emptyLive);
    const s = useCrmStore.getState();
    assert.equal(s.opportunities.length, 0);
    assert.equal(s.opportunitiesUnavailable, false);
    assert.ok(s.hydratedAt);
  });

  test("a live payload replaces what was in the store", () => {
    const [one] = seedOpportunities;
    useCrmStore.getState().hydrateFromWire({ ...emptyLive, opportunities: [one] });
    assert.deepEqual(
      useCrmStore.getState().opportunities.map((o) => o.id),
      [one.id],
    );
  });

  test("a failed live read is flagged unavailable, not empty", () => {
    useCrmStore.getState().hydrateFromWire({
      ...emptyLive,
      message: `leads live · ${OPPS_UNAVAILABLE_TAG} · LIVE failed (boom)`,
    });
    const s = useCrmStore.getState();
    assert.equal(s.opportunities.length, 0);
    assert.equal(s.opportunitiesUnavailable, true);
  });
});
