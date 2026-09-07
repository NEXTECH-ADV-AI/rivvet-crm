import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  correlationIdFromPayload,
  mapCanonicalActivityRow,
  dedupeCanonicalActivities,
  mapMissionTouchRow,
  mapConversionEventRow,
  deriveMissionChips,
  classifyLineageFetchError,
  type CanonicalActivity,
} from "./mission-lineage-map";

describe("correlationIdFromPayload — lineage extraction from payload jsonb", () => {
  test("extracts correlation_id from a parsed jsonb object", () => {
    assert.equal(
      correlationIdFromPayload({ correlation_id: "corr-123", other: "x" }),
      "corr-123",
    );
  });

  test("extracts correlation_id from a JSON-encoded string payload", () => {
    assert.equal(
      correlationIdFromPayload('{"correlation_id":"corr-456"}'),
      "corr-456",
    );
  });

  test("returns null, not empty string, when payload has no correlation_id", () => {
    assert.equal(correlationIdFromPayload({ other: "x" }), null);
  });

  test("returns null on null/undefined payload", () => {
    assert.equal(correlationIdFromPayload(null), null);
    assert.equal(correlationIdFromPayload(undefined), null);
  });

  test("returns null on unparseable string payload rather than throwing", () => {
    assert.equal(correlationIdFromPayload("{not json"), null);
  });
});

describe("mapCanonicalActivityRow", () => {
  test("maps a full activities row including nested correlation_id", () => {
    const row = {
      activity_id: "act-1",
      account_id: "acc-1",
      contact_id: null,
      gtm_lead_id: "lead-1",
      type: "email",
      subject: "Sent proposal",
      summary: "Follow-up",
      payload: { correlation_id: "corr-9" },
      occurred_at: "2026-09-01T00:00:00Z",
      source: "gtm_leads",
      source_ref: "gtm-lead-1:touch-9",
    };
    const mapped = mapCanonicalActivityRow(row);
    assert.equal(mapped.id, "act-1");
    assert.equal(mapped.sourceSystem, "gtm_leads");
    assert.equal(mapped.sourceRef, "gtm-lead-1:touch-9");
    assert.equal(mapped.correlationId, "corr-9");
    assert.equal(mapped.accountId, "acc-1");
    assert.equal(mapped.contactId, null);
    assert.equal(mapped.gtmLeadId, "lead-1");
    assert.equal(mapped.occurredAt, "2026-09-01T00:00:00Z");
  });
});

describe("dedupeCanonicalActivities — exactly-once display by (source, source_ref)", () => {
  function activity(overrides: Partial<CanonicalActivity>): CanonicalActivity {
    return {
      id: "id",
      sourceSystem: "app",
      sourceRef: "ref-1",
      correlationId: null,
      type: "note",
      subject: "s",
      summary: null,
      occurredAt: "2026-09-01T00:00:00Z",
      accountId: null,
      contactId: null,
      gtmLeadId: null,
      ...overrides,
    };
  }

  test("collapses two rows with the same (source, source_ref) into one and flags the duplicate", () => {
    const rows = [
      activity({ id: "a1", sourceSystem: "gtm_leads", sourceRef: "ref-dup" }),
      activity({ id: "a2", sourceSystem: "gtm_leads", sourceRef: "ref-dup" }),
    ];
    const { items, duplicates } = dedupeCanonicalActivities(rows);
    assert.equal(items.length, 1, "duplicate (source, source_ref) must collapse to one row");
    assert.equal(duplicates.length, 1);
    assert.deepEqual(duplicates[0], {
      sourceSystem: "gtm_leads",
      sourceRef: "ref-dup",
      count: 2,
    });
  });

  test("mutation check: distinct source_ref values are NOT flagged as duplicates", () => {
    const rows = [
      activity({ id: "a1", sourceSystem: "gtm_leads", sourceRef: "ref-1" }),
      activity({ id: "a2", sourceSystem: "gtm_leads", sourceRef: "ref-2" }),
    ];
    const { items, duplicates } = dedupeCanonicalActivities(rows);
    assert.equal(items.length, 2, "distinct source_ref rows must both survive");
    assert.equal(duplicates.length, 0);
  });

  test("mutation check: same source_ref but different source_system are NOT collapsed", () => {
    const rows = [
      activity({ id: "a1", sourceSystem: "gtm_leads", sourceRef: "shared-ref" }),
      activity({ id: "a2", sourceSystem: "manual", sourceRef: "shared-ref" }),
    ];
    const { items, duplicates } = dedupeCanonicalActivities(rows);
    assert.equal(
      items.length,
      2,
      "source is part of the dedupe key, not source_ref alone",
    );
    assert.equal(duplicates.length, 0);
  });

  test("sorts surviving items by occurred_at descending", () => {
    const rows = [
      activity({ id: "old", sourceRef: "r1", occurredAt: "2026-01-01T00:00:00Z" }),
      activity({ id: "new", sourceRef: "r2", occurredAt: "2026-09-01T00:00:00Z" }),
    ];
    const { items } = dedupeCanonicalActivities(rows);
    assert.equal(items[0].id, "new");
    assert.equal(items[1].id, "old");
  });
});

describe("mapMissionTouchRow / mapConversionEventRow", () => {
  test("maps a touch row", () => {
    const touch = mapMissionTouchRow({
      touch_id: "t1",
      mission_id: "m1",
      channel: "email",
      status: "sent",
      campaign_id: "c1",
      correlation_id: "corr-1",
      occurred_at: "2026-09-01T00:00:00Z",
    });
    assert.deepEqual(touch, {
      touchId: "t1",
      missionId: "m1",
      channel: "email",
      status: "sent",
      campaignId: "c1",
      correlationId: "corr-1",
      occurredAt: "2026-09-01T00:00:00Z",
    });
  });

  test("maps a conversion event row with null mission_id preserved as null", () => {
    const event = mapConversionEventRow({
      event_id: "e1",
      mission_id: null,
      event_type: "meeting_booked",
      correlation_id: "corr-2",
      occurred_at: "2026-09-02T00:00:00Z",
    });
    assert.equal(event.missionId, null);
    assert.equal(event.eventType, "meeting_booked");
  });
});

describe("deriveMissionChips", () => {
  test("groups touches and events by mission_id and counts each", () => {
    const touches = [
      mapMissionTouchRow({
        touch_id: "t1",
        mission_id: "m1",
        channel: "email",
        status: "sent",
        occurred_at: "2026-09-01T00:00:00Z",
      }),
      mapMissionTouchRow({
        touch_id: "t2",
        mission_id: "m1",
        channel: "call",
        status: "sent",
        occurred_at: "2026-09-02T00:00:00Z",
      }),
    ];
    const events = [
      mapConversionEventRow({
        event_id: "e1",
        mission_id: "m1",
        event_type: "meeting_booked",
        occurred_at: "2026-09-03T00:00:00Z",
      }),
    ];
    const chips = deriveMissionChips(touches, events);
    assert.equal(chips.length, 1);
    assert.equal(chips[0].missionId, "m1");
    assert.equal(chips[0].touchCount, 2);
    assert.equal(chips[0].conversionCount, 1);
    assert.equal(chips[0].lastOccurredAt, "2026-09-03T00:00:00Z");
    assert.deepEqual(chips[0].eventTypes, ["meeting_booked"]);
  });

  test("excludes rows with no mission_id rather than grouping them under a fake key", () => {
    const touches = [
      mapMissionTouchRow({
        touch_id: "t1",
        mission_id: null,
        channel: "email",
        status: "sent",
        occurred_at: "2026-09-01T00:00:00Z",
      }),
    ];
    const chips = deriveMissionChips(touches, []);
    assert.equal(chips.length, 0);
  });

  test("sorts chips by lastOccurredAt descending across missions", () => {
    const touches = [
      mapMissionTouchRow({
        touch_id: "t1",
        mission_id: "old-mission",
        channel: "email",
        status: "sent",
        occurred_at: "2026-01-01T00:00:00Z",
      }),
      mapMissionTouchRow({
        touch_id: "t2",
        mission_id: "new-mission",
        channel: "email",
        status: "sent",
        occurred_at: "2026-09-01T00:00:00Z",
      }),
    ];
    const chips = deriveMissionChips(touches, []);
    assert.equal(chips[0].missionId, "new-mission");
    assert.equal(chips[1].missionId, "old-mission");
  });
});

describe("classifyLineageFetchError — absent tables render unavailable, never zero", () => {
  test("404 status classifies as schema-not-released", () => {
    assert.match(classifyLineageFetchError(404, ""), /schema not yet released/);
  });

  test("PGRST205 body classifies as schema-not-released even on a non-404 status", () => {
    assert.match(
      classifyLineageFetchError(400, 'relation "public.gtm_touches" ... PGRST205'),
      /schema not yet released/,
    );
  });

  test("401/403 classify as access denied, distinct from a missing table", () => {
    assert.match(classifyLineageFetchError(401, ""), /access denied/);
    assert.match(classifyLineageFetchError(403, ""), /access denied/);
  });

  test("other statuses fall through to a generic fetch-failed reason", () => {
    assert.match(classifyLineageFetchError(500, ""), /fetch failed \(500\)/);
  });
});
