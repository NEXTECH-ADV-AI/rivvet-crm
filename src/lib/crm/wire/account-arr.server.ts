/**
 * Reads the two Platform tables behind account ARR (RIV-1942), server side only.
 * public.revenue_customers (who is revenue, and their Stripe customer id) and
 * public.deals (monthly_total, joined on stripe_customer_id). No Stripe call, no write.
 */

import type { Account } from "../types";
import { getServerSupabaseConfig } from "./config";
import { parseTotal } from "./supabase-rest.server";
import {
  ARR_UNAVAILABLE,
  billableStripeIds,
  deriveAccountArr,
  type ArrReads,
  type DealRow,
  type RevenueCustomerRow,
} from "./account-arr";

const PAGE = 1000;

/**
 * Every matching row or a throw. PostgREST caps a response, so one response is
 * not the whole set: read stable offset pages until the rows collected equal
 * the exact count, and fail closed on a missing or shifting count or a short page.
 */
async function getRows<T>(path: string, query: string, order: string): Promise<T[]> {
  const { url, key } = getServerSupabaseConfig();
  const rows: T[] = [];
  let total: number | null = null;
  do {
    const res = await fetch(
      `${url}/rest/v1/${path}?${query}&order=${order}&limit=${PAGE}&offset=${rows.length}`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          Prefer: "count=exact",
        },
      },
    );
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    const count = parseTotal(res.headers.get("content-range"));
    if (count === null) throw new Error(`${path} count missing`);
    if (total !== null && count !== total) throw new Error(`${path} count shifted`);
    total = count;
    const page = (await res.json()) as T[];
    if (rows.length < total && page.length === 0) throw new Error(`${path} short page`);
    rows.push(...page);
    if (rows.length > total) throw new Error(`${path} more rows than count`);
  } while (rows.length < total);
  return rows;
}

function inList(ids: string[]): string {
  return `in.(${ids.map((i) => encodeURIComponent(i)).join(",")})`;
}

export async function readArrSources(clientIds: string[]): Promise<ArrReads> {
  const ids = [...new Set(clientIds.filter(Boolean))];
  if (ids.length === 0) return { ok: true, revenue: [], deals: [] };
  try {
    const revenue = await getRows<RevenueCustomerRow>(
      "revenue_customers",
      `select=client_id,stripe_customer_id,billable&client_id=${inList(ids)}`,
      "stripe_customer_id",
    );
    const stripeIds = billableStripeIds(revenue);
    const deals =
      stripeIds.length === 0
        ? []
        : await getRows<DealRow>(
            "deals",
            `select=deal_id,stripe_customer_id,monthly_total&stripe_customer_id=${inList(stripeIds)}`,
            "deal_id",
          );
    return { ok: true, revenue, deals };
  } catch (error) {
    // A partial read would misstate ARR: show Unavailable, and log why.
    console.error("account ARR read unavailable:", error instanceof Error ? error.message : error);
    return { ok: false };
  }
}

/** Live accounts only: stamps arr and arrInfo. A failed read marks every account Unavailable. */
export async function withAccountArr(accounts: Account[]): Promise<Account[]> {
  const reads = await readArrSources(
    accounts.map((a) => a.clientId ?? "").filter(Boolean),
  );
  return accounts.map((a) => {
    const arrInfo = reads.ok ? deriveAccountArr(a.clientId, reads) : ARR_UNAVAILABLE;
    return { ...a, arrInfo, arr: arrInfo.state === "base_contract" ? arrInfo.arr : 0 };
  });
}
