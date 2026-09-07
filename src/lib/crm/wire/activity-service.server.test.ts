import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getMissionLineageService } from "./activity-service.server";

const ENV_KEYS = [
  "CRM_DATA_SOURCE",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRM_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
];
const savedEnv = new Map<string, string | undefined>();
const originalFetch = globalThis.fetch;

function stashEnv() {
  for (const k of ENV_KEYS) savedEnv.set(k, process.env[k]);
}
function restoreEnv() {
  for (const k of ENV_KEYS) {
    const v = savedEnv.get(k);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  globalThis.fetch = originalFetch;
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("getMissionLineageService", () => {
  beforeEach(() => {
    stashEnv();
    delete process.env.CRM_DATA_SOURCE;
  });
  afterEach(restoreEnv);

  test("mock mode: returns activities from seed as ok, missions/trial explicitly unavailable (not zero)", async () => {
    // No SUPABASE_SERVICE_ROLE_KEY set -> config resolves to mock.
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.CRM_SUPABASE_SERVICE_ROLE_KEY;

    const result = await getMissionLineageService({ accountId: "A-214" });
    assert.equal(result.source, "mock");
    assert.equal(result.activities.status, "ok");
    assert.equal(result.missions.status, "unavailable");
    assert.match((result.missions as { reason: string }).reason, /mock mode/);
    assert.equal(result.trial.status, "unavailable");
  });

  test("live mode, tables not yet migrated (404/PGRST205): missions render unavailable with reason, never an empty ok result", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rest/v1/gtm_touches") || url.includes("/rest/v1/gtm_conversion_events")) {
        return jsonResponse(404, { message: "relation not found", code: "PGRST205" });
      }
      if (url.includes("/rest/v1/activities")) {
        return jsonResponse(200, []);
      }
      if (url.includes("/rest/v1/trial_signups")) {
        return jsonResponse(200, []);
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await getMissionLineageService({ accountId: "acc-live-1" });
    assert.equal(result.source, "live");
    assert.equal(
      result.missions.status,
      "unavailable",
      "a 404 from an unmigrated table must never be reported as an ok result with 0 chips",
    );
    assert.match((result.missions as { reason: string }).reason, /schema not yet released/);
  });

  test("live mode, activities fetch succeeds with a true duplicate (source, source_ref): service surfaces the duplicate flag, not a silently deduped count", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rest/v1/activities")) {
        return jsonResponse(200, [
          {
            activity_id: "act-1",
            account_id: "acc-live-2",
            type: "email",
            subject: "Touch A",
            payload: { correlation_id: "corr-a" },
            occurred_at: "2026-09-01T00:00:00Z",
            source: "gtm_leads",
            source_ref: "shared-ref",
          },
          {
            activity_id: "act-2",
            account_id: "acc-live-2",
            type: "email",
            subject: "Touch A retried",
            payload: { correlation_id: "corr-a" },
            occurred_at: "2026-09-01T00:05:00Z",
            source: "gtm_leads",
            source_ref: "shared-ref",
          },
        ]);
      }
      if (url.includes("/rest/v1/gtm_touches") || url.includes("/rest/v1/gtm_conversion_events")) {
        return jsonResponse(404, { code: "PGRST205" });
      }
      if (url.includes("/rest/v1/trial_signups")) {
        return jsonResponse(200, []);
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await getMissionLineageService({ accountId: "acc-live-2" });
    assert.equal(result.activities.status, "ok");
    if (result.activities.status === "ok") {
      assert.equal(result.activities.items.length, 1);
      assert.equal(result.activities.duplicates.length, 1);
      assert.equal(result.activities.duplicates[0].count, 2);
    }
  });

  test("live mode, no client_id on account: trial renders unavailable with reason, never a fabricated state", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rest/v1/activities")) return jsonResponse(200, []);
      if (url.includes("/rest/v1/gtm_touches") || url.includes("/rest/v1/gtm_conversion_events")) {
        return jsonResponse(404, { code: "PGRST205" });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await getMissionLineageService({ accountId: "acc-no-client", clientId: null });
    assert.equal(result.trial.status, "unavailable");
    assert.match((result.trial as { reason: string }).reason, /no client_id/);
  });
});
