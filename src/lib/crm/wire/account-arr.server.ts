/**
 * Reads billable customers and their deals from Platform, server side, GET only (RIV-1942).
 */

import type { Account } from "../types";
import { getServerSupabaseConfig } from "./config";
import { arrFor, type ArrByClient } from "./account-arr";

// ponytail: one page; a set this size (5 billable today) never nears it. Fails closed if it does.
const MAX_ROWS = 1000;

async function get<T>(path: string): Promise<T[]> {
  const { url, key } = getServerSupabaseConfig();
  const res = await fetch(`${url}/rest/v1/${path}&limit=${MAX_ROWS}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}`);
  const rows = (await res.json()) as T[];
  if (rows.length >= MAX_ROWS) throw new Error(`${path.split("?")[0]} may be truncated`);
  return rows;
}

export async function readArrByClient(): Promise<ArrByClient> {
  try {
    const billable = await get<{ client_id: string | null; stripe_customer_id: string }>(
      "revenue_customers?select=client_id,stripe_customer_id&billable=eq.true",
    );
    const ids = billable.map((r) => r.stripe_customer_id);
    const deals = ids.length
      ? await get<{ stripe_customer_id: string; monthly_total: number | string | null }>(
          `deals?select=stripe_customer_id,monthly_total&stripe_customer_id=in.(${ids.map(encodeURIComponent).join(",")})`,
        )
      : [];
    const byClient = new Map<string, number>();
    for (const r of billable) {
      if (!r.client_id) continue;
      const mine = deals.filter((d) => d.stripe_customer_id === r.stripe_customer_id);
      // One deal is the contract; none or several is a data problem, shown as Unavailable.
      const arr = mine.length === 1 ? Number(mine[0].monthly_total) * 12 : NaN;
      byClient.set(r.client_id, byClient.has(r.client_id) ? NaN : Math.round(arr));
    }
    return byClient;
  } catch (error) {
    console.error("account ARR read unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Stamps arr and arrInfo on live accounts; a failed read marks them all Unavailable. */
export async function withAccountArr(accounts: Account[]): Promise<Account[]> {
  const byClient = await readArrByClient();
  return accounts.map((a) => {
    const arrInfo = arrFor(a.clientId, byClient);
    return { ...a, arrInfo, arr: arrInfo.state === "base_contract" ? arrInfo.arr : 0 };
  });
}
