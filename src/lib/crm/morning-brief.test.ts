import { afterEach, beforeEach, mock, test } from "node:test";
import { Socket } from "node:net";
import { createHmac } from "node:crypto";
import { requestHandler } from "@tanstack/react-start/server";
import { signSession } from "../auth/crm-session-token";
import assert from "node:assert/strict";
import { readFounderMorningBrief } from "./morning-brief.server";
import { morningIsStale, parseMorningBriefEnvelope, safeHttpUrl } from "./preview-config-contract";

const now = Date.parse("2026-11-14T17:00:00Z");
const env = {
  VERCEL_ENV: "preview",
  RIVVET_PREVIEW_CONFIG_ID: "fixture_config",
  RIVVET_PREVIEW_CONFIG_TOKEN: "fixture-read-token",
};
const founder = () => ({ email: "brayden@rivvetai.com" });
function fixture() {
  return {
    schemaVersion: 1,
    environment: "preview",
    syncedAt: "2026-11-14T16:00:00Z",
    sourceSiteId: "appgprj_6af47ebfac84819196eab5b46618fc3d",
    snapshot: {
      schemaVersion: 1,
      runId: "isolated-fixture",
      generatedAt: "2026-11-14T15:00:00Z",
      period: {
        label: "Fixture window",
        start: "2026-10-14T06:00:00Z",
        end: "2026-11-14T07:00:00Z",
      },
      brief: {
        title: "Fixture priority",
        subtitle: "Fixture context",
        detail: "Review the isolated fixture.",
      },
      priorities: [
        {
          title: "Fixture action",
          action: "Review the fixture",
          label: "Recommended",
          tone: "urgent",
          owner: "Fixture owner",
          due: "",
          url: "https://example.invalid/priority",
          sourceLabel: "Fixture source",
        },
      ],
      customers: [
        {
          name: "Fixture customer",
          state: "waiting",
          status: "Waiting",
          action: "Monitor the fixture",
          lastContact: "Fixture date",
          url: "https://example.invalid/thread",
          issueUrl: "",
        },
      ],
      sources: [
        {
          name: "Fixture source",
          status: "ok",
          checkedAt: "2026-11-14T14:00:00Z",
          note: "Isolated fixture only",
        },
      ],
      sales: { privateExtra: "sales-not-returned" },
      engineering: { privateExtra: "engineering-not-returned" },
      agenda: [{ privateExtra: "agenda-not-returned" }],
    },
  };
}

beforeEach(() => {
  mock.method(Socket.prototype, "connect", () => {
    throw new Error("Real networking denied for morning-brief tests");
  });
});
afterEach(() => mock.restoreAll());

test("actual session is checked before config access or fetch; evaluator and other users get no private data", async () => {
  let requests = 0;
  const deniedFetch = (async () => {
    requests += 1;
    throw new Error("Unexpected fetch");
  }) as typeof fetch;
  const unreadableEnv = new Proxy(
    {},
    {
      get() {
        throw new Error("Config accessed before authorization");
      },
    },
  );
  for (const readSession of [
    () => null,
    () => ({ email: "evaluator@rivvetai.com" }),
    () => ({ email: "other@rivvetai.com" }),
    () => ({ email: "brayden@rivvetai.com.evil.invalid" }),
    () => {
      throw new Error("Session unavailable");
    },
  ]) {
    assert.deepEqual(
      await readFounderMorningBrief({ readSession, env: unreadableEnv, fetch: deniedFetch, now }),
      { status: "hidden" },
    );
  }
  assert.equal(requests, 0);
});

test("production and local runtime skip the preview store even for the founder", async () => {
  const deniedFetch = (async () => {
    throw new Error("Unexpected fetch");
  }) as typeof fetch;
  for (const value of ["production", "development", undefined]) {
    assert.deepEqual(
      await readFounderMorningBrief({
        readSession: founder,
        env: { ...env, VERCEL_ENV: value },
        fetch: deniedFetch,
        now,
      }),
      { status: "hidden" },
    );
  }
});

test("founder preview read is GET-only, no-store and returns a compact credential-free view", async () => {
  let requests = 0;
  const result = await readFounderMorningBrief({
    readSession: founder,
    env,
    now,
    fetch: (async (input, init) => {
      requests += 1;
      assert.equal(
        String(input),
        "https://global-config.vercel.com/fixture_config/item/morning_brief",
      );
      assert.equal(init?.method, "GET");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-read-token");
      assert.ok(init?.signal);
      return new Response(JSON.stringify(fixture()));
    }) as typeof fetch,
  });
  assert.equal(requests, 1);
  assert.equal(result.status, "ready");
  assert.doesNotMatch(
    JSON.stringify(result),
    /fixture-read-token|sales-not-returned|engineering-not-returned|agenda-not-returned|isolated-fixture|sourceSiteId/,
  );
});

test("missing bindings, failed reads and malformed or oversized bodies expose no provider text", async () => {
  const missing = await readFounderMorningBrief({
    readSession: founder,
    env: { VERCEL_ENV: "preview" },
    now,
  });
  assert.equal(missing.status, "unavailable");
  for (const response of [
    new Response("private-provider-error fixture-read-token", { status: 403 }),
    new Response("not json"),
    new Response(JSON.stringify({ schemaVersion: 2, privateExtra: "must-not-return" })),
    new Response("x".repeat(1_000_001)),
  ]) {
    const result = await readFounderMorningBrief({
      readSession: founder,
      env,
      now,
      fetch: (async () => response) as typeof fetch,
    });
    assert.equal(result.status, "unavailable");
    assert.doesNotMatch(
      JSON.stringify(result),
      /private-provider-error|fixture-read-token|must-not-return|not json/,
    );
  }
});

test("fresh preview sync never makes an old brief or failed source fresh", () => {
  const old = fixture();
  old.snapshot.generatedAt = "2026-11-12T15:00:00Z";
  old.snapshot.sources[0].checkedAt = "2026-11-12T14:00:00Z";
  old.snapshot.sources[0].status = "stale";
  const parsed = parseMorningBriefEnvelope(old, now)!;
  assert.equal(parsed.generatedAt, "2026-11-12T15:00:00Z");
  assert.equal(parsed.syncedAt, "2026-11-14T16:00:00Z");
  assert.equal(parsed.stale, true);
  assert.equal(parsed.partial, true);
  for (const status of ["partial", "stale", "unavailable"]) {
    const failed = fixture();
    failed.snapshot.sources[0].status = status;
    assert.equal(parseMorningBriefEnvelope(failed, now)?.partial, true);
  }
  const noSources = fixture();
  noSources.snapshot.sources = [];
  assert.equal(parseMorningBriefEnvelope(noSources, now)?.partial, true);
});

test("unknown shapes, unsafe links and future source timestamps fail closed", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/private",
    "//evil.invalid",
    "https://user:pass@example.invalid",
  ]) {
    assert.equal(safeHttpUrl(url), undefined);
    const invalid = fixture();
    invalid.snapshot.priorities[0].url = url;
    assert.equal(parseMorningBriefEnvelope(invalid, now), null);
  }
  assert.equal(safeHttpUrl("https://example.invalid/safe"), "https://example.invalid/safe");
  assert.equal(safeHttpUrl("http://example.invalid/safe"), "http://example.invalid/safe");
  const future = fixture();
  future.snapshot.sources[0].checkedAt = "2027-01-01T00:00:00Z";
  assert.equal(parseMorningBriefEnvelope(future, now), null);
  const wrongSite = fixture();
  wrongSite.sourceSiteId = "another-site";
  assert.equal(parseMorningBriefEnvelope(wrongSite, now), null);
  const tooMany = fixture();
  tooMany.snapshot.priorities = Array(31).fill(tooMany.snapshot.priorities[0]);
  assert.equal(parseMorningBriefEnvelope(tooMany, now), null);
});

test("unknown nested fields never leak through the compact DTO", () => {
  const value = fixture();
  Object.assign(value.snapshot.brief, { privateExtra: "private-field-marker" });
  Object.assign(value.snapshot.priorities[0], { accessToken: "private-field-marker" });
  Object.assign(value.snapshot.customers[0], { rawThread: "private-field-marker" });
  Object.assign(value.snapshot.sources[0], { credential: "private-field-marker" });
  const parsed = parseMorningBriefEnvelope(value, now);
  assert.ok(parsed);
  assert.doesNotMatch(
    JSON.stringify(parsed),
    /private-field-marker|privateExtra|accessToken|rawThread|credential/,
  );
});

test("unavailable sources retain an absent checkedAt and invalid enum types are rejected", () => {
  const base = fixture();
  const unavailable = {
    ...base,
    snapshot: {
      ...base.snapshot,
      sources: [{ ...base.snapshot.sources[0], status: "unavailable", checkedAt: null }],
    },
  };
  const parsed = parseMorningBriefEnvelope(unavailable, now);
  assert.equal(parsed?.sources[0].checkedAt, null);
  assert.equal(parsed?.partial, true);
  const invalid = {
    ...base,
    snapshot: {
      ...base.snapshot,
      priorities: [{ ...base.snapshot.priorities[0], tone: ["urgent"] }],
    },
  };
  assert.equal(parseMorningBriefEnvelope(invalid, now), null);
});

test("native request cookies enforce the actual signed session email on the server reader", async () => {
  const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated-session-fixture-key";
  const signingKey = createHmac("sha256", "isolated-session-fixture-key")
    .update("rivvet-crm-session-v1")
    .digest("hex");
  let requests = 0;
  const handler = requestHandler(async () =>
    Response.json(
      await readFounderMorningBrief({
        env,
        now,
        fetch: (async () => {
          requests += 1;
          return new Response(JSON.stringify(fixture()));
        }) as typeof fetch,
      }),
    ),
  );
  const request = async (cookie: string) => {
    const response = await handler(
      new Request("https://crm-preview.invalid/home", {
        headers: cookie ? { Cookie: `rivvet_crm_session=${cookie}` } : {},
      }),
      {},
    );
    return response.json();
  };
  try {
    const founderCookie = signSession("brayden@rivvetai.com", Date.now() + 60_000, signingKey);
    assert.equal((await request(founderCookie)).status, "ready");
    assert.equal(requests, 1);
    for (const email of ["evaluator@rivvetai.com", "another@rivvetai.com"]) {
      assert.deepEqual(await request(signSession(email, Date.now() + 60_000, signingKey)), {
        status: "hidden",
      });
    }
    assert.deepEqual(await request(founderCookie + "tampered"), { status: "hidden" });
    assert.deepEqual(await request(""), { status: "hidden" });
    assert.equal(requests, 1, "non-founder and forged sessions never reach the private store");
  } finally {
    if (saved === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
  }
});

test("morning freshness follows the 07:30 Denver deadline across standard and daylight time", () => {
  assert.equal(morningIsStale("2026-11-13T15:00:00Z", Date.parse("2026-11-14T14:29:00Z")), false);
  assert.equal(morningIsStale("2026-11-13T15:00:00Z", Date.parse("2026-11-14T14:30:00Z")), true);
  assert.equal(morningIsStale("2026-07-14T14:00:00Z", Date.parse("2026-07-15T13:29:00Z")), false);
  assert.equal(morningIsStale("2026-07-14T14:00:00Z", Date.parse("2026-07-15T13:30:00Z")), true);
  assert.equal(morningIsStale("2026-11-13T15:00:00Z", Date.parse("2026-11-14T07:01:00Z")), false);
});
