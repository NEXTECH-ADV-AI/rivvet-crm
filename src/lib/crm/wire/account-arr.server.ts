/**
 * Reads the two Platform tables behind account ARR (RIV-1942), server side only.
 * public.revenue_customers (who is revenue) and public.billing_rate_configs
 * (the stored contracted base fee). No Stripe call, no write.
 */

import type { Account } from "../types";
import { getServerSupabaseConfig } from "./config";
import {
  ARR_UNAVAILABLE,
  billableClientIds,
  deriveAccountArr,
  type ArrReads,
  type RateConfigRow,
  type RevenueCustomerRow,
} from "./account-arr";

async function getRows<T>(path: string, query: string): Promise<T[]> {
  const { url, key } = getServerSupabaseConfig();
  const res = await fetch(`${url}/rest/v1/${path}?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T[];
}

function inList(ids: string[]): string {
  return `in.(${ids.map((i) => encodeURIComponent(i)).join(",")})`;
}

export async function readArrSources(clientIds: string[]): Promise<ArrReads> {
  const ids = [...new Set(clientIds.filter(Boolean))];
  if (ids.length === 0) return { ok: true, revenue: [], rates: [] };
  try {
    const revenue = await getRows<RevenueCustomerRow>(
      "revenue_customers",
      `select=client_id,billable&client_id=${inList(ids)}`,
    );
    const billable = [...billableClientIds(revenue)];
    const rates =
      billable.length === 0
        ? []
        : await getRows<RateConfigRow>(
            "billing_rate_configs",
            `select=client_id,base_fee_cents&is_active=eq.true&client_id=${inList(billable)}`,
          );
    return { ok: true, revenue, rates };
  } catch {
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
