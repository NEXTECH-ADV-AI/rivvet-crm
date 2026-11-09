import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { arrHeadline, arrText, deriveAccountArr, type ArrReads } from "./account-arr";
import { listAccountsService } from "./account-service.server";
import { formatMoney } from "../priority";

const HILLCREST = "c6f34490-f878-4b9b-88ad-bab827514c58";
const EZ = "b4ceb979-8f52-45c0-ab5a-ac6f6d86b3bf";
const NOSTAIRA = "927c4e60-7cd6-43ef-ab55-d6357b0145da";
const OPACHS = "fc970cfc-cdab-414e-9e0f-4073e0be2e30";
const OTHER = "11111111-1111-1111-1111-111111111111";

const reads: ArrReads = {
  ok: true,
  revenue: [
    { client_id: HILLCREST, billable: true },
    { client_id: EZ, billable: true },
    { client_id: NOSTAIRA, billable: true },
    { client_id: OPACHS, billable: false },
  ],
  rates: [
    { client_id: HILLCREST, base_fee_cents: 50000 },
    { client_id: EZ, base_fee_cents: "50000" },
  ],
};

describe("deriveAccountArr", () => {
  test("billable with a stored base fee is base fee x 12 in dollars", () => {
    assert.deepEqual(deriveAccountArr(HILLCREST, reads), { state: "base_contract", arr: 6000 });
    assert.deepEqual(deriveAccountArr(EZ, reads), { state: "base_contract", arr: 6000 });
  });
  test("billable with no stored contract value is Not available, never a guess", () => {
    assert.deepEqual(deriveAccountArr(NOSTAIRA, reads), { state: "not_available" });
  });
  test("a zero or null base fee is Not available", () => {
    const r: ArrReads = {
      ok: true,
      revenue: [{ client_id: HILLCREST, billable: true }],
      rates: [{ client_id: HILLCREST, base_fee_cents: 0 }],
    };
    assert.deepEqual(deriveAccountArr(HILLCREST, r), { state: "not_available" });
    r.rates = [{ client_id: HILLCREST, base_fee_cents: null }];
    assert.deepEqual(deriveAccountArr(HILLCREST, r), { state: "not_available" });
  });
  test("non-billable, unregistered and client-less accounts have none, even with a rate config", () => {
    const withRate: ArrReads = {
      ok: true,
      revenue: reads.ok ? reads.revenue : [],
      rates: [{ client_id: OPACHS, base_fee_cents: 50000 }, { client_id: OTHER, base_fee_cents: 50000 }],
    };
    assert.deepEqual(deriveAccountArr(OPACHS, withRate), { state: "not_billable" });
    assert.deepEqual(deriveAccountArr(OTHER, withRate), { state: "not_billable" });
    assert.deepEqual(deriveAccountArr(null, withRate), { state: "not_billable" });
  });
  test("a failed read is Unavailable for every account", () => {
    assert.deepEqual(deriveAccountArr(HILLCREST, { ok: false }), { state: "unavailable" });
    assert.deepEqual(deriveAccountArr(null, { ok: false }), { state: "unavailable" });
  });
});

describe("labels", () => {
  test("cells and headline say what the figure is", () => {
    const base = { arr: 6000, arrInfo: { state: "base_contract", arr: 6000 } } as const;
    assert.equal(arrText(base, formatMoney), "$6,000");
    assert.equal(arrHeadline(base, formatMoney), "$6,000 base ARR");
    const un = { arr: 0, arrInfo: { state: "unavailable" } } as const;
    assert.equal(arrText(un, formatMoney), "Unavailable");
    assert.equal(arrHeadline(un, formatMoney), "ARR unavailable");
    const na = { arr: 0, arrInfo: { state: "not_available" } } as const;
    assert.equal(arrText(na, formatMoney), "Not available");
    assert.equal(arrHeadline(na, formatMoney), "ARR not available");
    const none = { arr: 0, arrInfo: { state: "not_billable" } } as const;
    assert.equal(arrText(none, formatMoney), null);
    assert.equal(arrHeadline(none, formatMoney), null);
  });
});

describe("listAccountsService ARR (live)", () => {
  const ENV = ["CRM_DATA_SOURCE", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"];
  const saved = new Map<string, string | undefined>();
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    for (const k of ENV) saved.set(k, process.env[k]);
    delete process.env.CRM_DATA_SOURCE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_URL = "https://example.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });
  afterEach(() => {
    for (const k of ENV) {
      const v = saved.get(k);
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    globalThis.fetch = originalFetch;
  });

  const accountRows = [
    { account_id: "a1", name: "Hillcrest", client_id: HILLCREST },
    { account_id: "a2", name: "Nostaira", client_id: NOSTAIRA },
    { account_id: "a3", name: "Opachs", client_id: OPACHS },
    { account_id: "a4", name: "Prospect", client_id: null },
  ];

  function stub(opts: { revenue?: number; rates?: number }) {
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const u = String(input);
      urls.push(u);
      if (u.includes("/rest/v1/accounts?")) {
        return new Response(JSON.stringify(accountRows), {
          status: 200,
          headers: { "content-range": "0-3/4" },
        });
      }
      if (u.includes("/rest/v1/revenue_customers?")) {
        if (opts.revenue) return new Response("boom", { status: opts.revenue });
        return new Response(JSON.stringify(reads.ok ? reads.revenue : []), { status: 200 });
      }
      if (u.includes("/rest/v1/billing_rate_configs?")) {
        if (opts.rates) return new Response("boom", { status: opts.rates });
        return new Response(JSON.stringify([{ client_id: HILLCREST, base_fee_cents: 50000 }]), { status: 200 });
      }
      return new Response("unexpected " + u, { status: 500 });
    }) as typeof fetch;
    return urls;
  }

  test("billable shows contract ARR, Nostaira Not available, non-billable none", async () => {
    const urls = stub({});
    const r = await listAccountsService({});
    assert.equal(r.source, "live");
    const by = Object.fromEntries(r.accounts.map((a) => [a.name, a]));
    assert.equal(by.Hillcrest.arr, 6000);
    assert.equal(by.Hillcrest.arrInfo?.state, "base_contract");
    assert.equal(by.Nostaira.arr, 0);
    assert.equal(by.Nostaira.arrInfo?.state, "not_available");
    assert.equal(by.Opachs.arrInfo?.state, "not_billable");
    assert.equal(by.Prospect.arrInfo?.state, "not_billable");
    assert.ok(urls.some((u) => u.includes("billing_rate_configs") && u.includes("is_active=eq.true")));
    assert.ok(!urls.some((u) => u.includes("select=") && /accounts\?.*(arr|mrr)/.test(u)), "never selects arr or mrr from accounts");
  });

  test("a failed revenue read marks ARR Unavailable but keeps the account rows", async () => {
    stub({ revenue: 500 });
    const r = await listAccountsService({});
    assert.equal(r.accounts.length, 4);
    for (const a of r.accounts) assert.equal(a.arrInfo?.state, "unavailable");
    assert.ok(r.accounts.every((a) => a.arr === 0));
  });

  test("a failed contract read marks ARR Unavailable, not zero", async () => {
    stub({ rates: 500 });
    const r = await listAccountsService({});
    for (const a of r.accounts) assert.equal(a.arrInfo?.state, "unavailable");
  });

  test("a failed accounts read is still zero rows with the unavailable message", async () => {
    globalThis.fetch = (async () => new Response("boom", { status: 500 })) as typeof fetch;
    const r = await listAccountsService({});
    assert.equal(r.accounts.length, 0);
    assert.match(r.message ?? "", /unavailable/);
  });
});
