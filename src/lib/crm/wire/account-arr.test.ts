import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { arrHeadline, arrText } from "./account-arr";
import { withAccountArr } from "./account-arr.server";
import { formatMoney } from "../priority";
import type { Account } from "../types";

const realFetch = globalThis.fetch;
afterEach(() => (globalThis.fetch = realFetch));
process.env.SUPABASE_URL = "https://example.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

const billable = [
  { client_id: "hillcrest", stripe_customer_id: "cus_h" },
  { client_id: "honest-fix", stripe_customer_id: "cus_f" },
  { client_id: "two-deals", stripe_customer_id: "cus_2" },
];
const deals = [
  { stripe_customer_id: "cus_h", monthly_total: "500.00" },
  { stripe_customer_id: "cus_f", monthly_total: "350.00" },
  { stripe_customer_id: "cus_2", monthly_total: "100.00" },
  { stripe_customer_id: "cus_2", monthly_total: "200.00" },
];
const acct = (clientId: string | null) => ({ clientId, arr: 0 }) as unknown as Account;
const ok = (rows: unknown[], total = rows.length) =>
  new Response(JSON.stringify(rows), { status: 200, headers: { "content-range": `0-${rows.length - 1}/${total}` } });

test("ARR matches the database: billable x deal monthly x 12, everyone else not billable", async () => {
  const calls: string[] = [];
  const seen: string[] = [];
  globalThis.fetch = (async (u: string, init?: RequestInit) => {
    seen.push(u);
    calls.push(`${init?.method ?? "GET"} ${u.split("?")[0]}`);
    return ok(u.includes("/revenue_customers") ? billable : deals);
  }) as typeof fetch;
  const out = await withAccountArr(["hillcrest", "honest-fix", "two-deals", "prospect", null].map(acct));
  assert.deepEqual(
    out.map((a) => arrText(a, formatMoney)),
    ["$6,000", "$4,200", "Unavailable", null, null],
  );
  assert.equal(arrHeadline(out[1], formatMoney), "$4,200 base ARR");
  assert.equal(arrHeadline({ arr: 1200 } as Account, formatMoney), "$1,200 ARR");
  assert.ok(calls.every((c) => c.startsWith("GET ")));
  assert.ok(seen[0].includes("client_id=in.("), "billable read is scoped to the requested accounts");
});

test("a failed read shows Unavailable on every account, never a number", async () => {
  globalThis.fetch = (async () => new Response("down", { status: 500 })) as typeof fetch;
  const out = await withAccountArr([acct("hillcrest"), acct("prospect")]);
  assert.deepEqual(out.map((a) => arrText(a, formatMoney)), ["Unavailable", "Unavailable"]);
  assert.deepEqual(out.map((a) => a.arr), [0, 0]);
});

test("a truncated read (server cap hides a second deal) shows Unavailable, not a contract number", async () => {
  globalThis.fetch = (async (u: string) =>
    u.includes("/revenue_customers") ? ok(billable) : ok(deals.slice(0, 2), deals.length)) as typeof fetch;
  const out = await withAccountArr([acct("hillcrest"), acct("two-deals")]);
  assert.deepEqual(out.map((a) => arrText(a, formatMoney)), ["Unavailable", "Unavailable"]);
});
