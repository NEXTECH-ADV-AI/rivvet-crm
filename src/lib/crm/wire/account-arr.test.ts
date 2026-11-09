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

const revenue = [
  { client_id: HILLCREST, stripe_customer_id: "cus_hill", billable: true },
  { client_id: EZ, stripe_customer_id: "cus_ez", billable: true },
  { client_id: NOSTAIRA, stripe_customer_id: "cus_nos", billable: true },
  { client_id: OPACHS, stripe_customer_id: "cus_opachs", billable: false },
];
// Opachs has a deal too: a non-billable account must still show no ARR.
const deals = [
  { stripe_customer_id: "cus_hill", monthly_total: 500 },
  { stripe_customer_id: "cus_nos", monthly_total: "250.00" },
  { stripe_customer_id: "cus_ez", monthly_total: 500 },
  { stripe_customer_id: "cus_ez", monthly_total: 500 },
  { stripe_customer_id: "cus_opachs", monthly_total: 500 },
];
const reads: ArrReads = { ok: true, revenue, deals };

describe("deriveAccountArr", () => {
  test("billable with a matching deal is monthly_total x 12", () => {
    assert.deepEqual(deriveAccountArr(HILLCREST, reads), { state: "base_contract", arr: 6000 });
    assert.deepEqual(deriveAccountArr(NOSTAIRA, reads), { state: "base_contract", arr: 3000 });
  });
  test("two deals on one Stripe customer is Unavailable, never a sum or a pick", () => {
    assert.deepEqual(deriveAccountArr(EZ, reads), { state: "unavailable" });
  });
  test("two billable Stripe customers on one account is Unavailable", () => {
    const r: ArrReads = {
      ok: true,
      revenue: [
        { client_id: HILLCREST, stripe_customer_id: "cus_a", billable: true },
        { client_id: HILLCREST, stripe_customer_id: "cus_b", billable: true },
      ],
      deals: [
        { stripe_customer_id: "cus_a", monthly_total: 500 },
        { stripe_customer_id: "cus_b", monthly_total: 100 },
      ],
    };
    assert.deepEqual(deriveAccountArr(HILLCREST, r), { state: "unavailable" });
  });
  test("a null, zero or non-numeric monthly_total is Unavailable", () => {
    for (const monthly_total of [null, 0, "abc"]) {
      const r: ArrReads = {
        ok: true,
        revenue: [{ client_id: HILLCREST, stripe_customer_id: "cus_hill", billable: true }],
        deals: [{ stripe_customer_id: "cus_hill", monthly_total }],
      };
      assert.deepEqual(deriveAccountArr(HILLCREST, r), { state: "unavailable" });
    }
  });
  test("billable with no deal row, or no Stripe id, is Not available", () => {
    const noDeal: ArrReads = {
      ok: true,
      revenue: [{ client_id: HILLCREST, stripe_customer_id: "cus_hill", billable: true }],
      deals: [],
    };
    assert.deepEqual(deriveAccountArr(HILLCREST, noDeal), { state: "not_available" });
    const noStripe: ArrReads = {
      ok: true,
      revenue: [{ client_id: HILLCREST, stripe_customer_id: null, billable: true }],
      deals,
    };
    assert.deepEqual(deriveAccountArr(HILLCREST, noStripe), { state: "not_available" });
  });
  test("non-billable, unregistered and client-less accounts have none, even with a deal", () => {
    assert.deepEqual(deriveAccountArr(OPACHS, reads), { state: "not_billable" });
    assert.deepEqual(deriveAccountArr(OTHER, reads), { state: "not_billable" });
    assert.deepEqual(deriveAccountArr(null, reads), { state: "not_billable" });
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
    { account_id: "a5", name: "EZ Services", client_id: EZ },
  ];

  function stub(opts: { revenue?: number; deals?: number }) {
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const u = String(input);
      urls.push(u);
      if (u.includes("/rest/v1/accounts?")) {
        return new Response(JSON.stringify(accountRows), {
          status: 200,
          headers: { "content-range": "0-4/5" },
        });
      }
      if (u.includes("/rest/v1/revenue_customers?")) {
        if (opts.revenue) return new Response("boom", { status: opts.revenue });
        return new Response(JSON.stringify(revenue), { status: 200 });
      }
      if (u.includes("/rest/v1/deals?")) {
        if (opts.deals) return new Response("boom", { status: opts.deals });
        return new Response(JSON.stringify(deals), { status: 200 });
      }
      return new Response("unexpected " + u, { status: 500 });
    }) as typeof fetch;
    return urls;
  }

  test("billable shows deal ARR, ambiguous Unavailable, non-billable none", async () => {
    const urls = stub({});
    const r = await listAccountsService({});
    assert.equal(r.source, "live");
    const by = Object.fromEntries(r.accounts.map((a) => [a.name, a]));
    assert.equal(by.Hillcrest.arr, 6000);
    assert.equal(by.Hillcrest.arrInfo?.state, "base_contract");
    assert.equal(by.Nostaira.arr, 3000);
    assert.equal(by.Nostaira.arrInfo?.state, "base_contract");
    assert.equal(by["EZ Services"].arr, 0);
    assert.equal(by["EZ Services"].arrInfo?.state, "unavailable");
    assert.equal(by.Opachs.arrInfo?.state, "not_billable");
    assert.equal(by.Prospect.arrInfo?.state, "not_billable");
    assert.ok(urls.some((u) => u.includes("/rest/v1/deals?") && u.includes("stripe_customer_id=in.")));
    assert.ok(!urls.some((u) => u.includes("billing_rate_configs")), "no longer reads billing_rate_configs");
    assert.ok(!urls.some((u) => u.includes("select=") && /accounts\?.*(arr|mrr)/.test(u)), "never selects arr or mrr from accounts");
  });

  test("a failed revenue read marks ARR Unavailable but keeps the account rows", async () => {
    stub({ revenue: 500 });
    const r = await listAccountsService({});
    assert.equal(r.accounts.length, 5);
    for (const a of r.accounts) assert.equal(a.arrInfo?.state, "unavailable");
    assert.ok(r.accounts.every((a) => a.arr === 0));
  });

  test("a failed deals read marks ARR Unavailable, not zero", async () => {
    stub({ deals: 500 });
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
