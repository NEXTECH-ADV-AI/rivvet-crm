/**
 * Account ARR rules (RIV-1942). Pure, shared by the server read and the UI.
 *
 * ARR here is contract ARR only: the deal's monthly_total x 12. Per-booking
 * usage and RevShare are variable and never projected. The join is
 * account.client_id -> public.revenue_customers (billable, RIV-1937) ->
 * its stripe_customer_id -> public.deals.stripe_customer_id. An unregistered
 * or non-billable account has no ARR. Ambiguity or a missing value is
 * Unavailable, never a guess or a sum.
 */

import type { Account, AccountArrInfo } from "../types";

export type RevenueCustomerRow = {
  client_id: string | null;
  stripe_customer_id: string | null;
  billable: boolean;
};

export type DealRow = {
  stripe_customer_id: string | null;
  monthly_total: number | string | null;
};

export type ArrReads =
  | { ok: true; revenue: RevenueCustomerRow[]; deals: DealRow[] }
  | { ok: false };

export const ARR_UNAVAILABLE: AccountArrInfo = { state: "unavailable" };

/** Billable revenue rows for one client (any billable row makes the client billable). */
function billableRows(revenue: RevenueCustomerRow[], clientId: string): RevenueCustomerRow[] {
  return revenue.filter((r) => r.billable === true && r.client_id === clientId);
}

/** Distinct Stripe customer ids of billable rows, for every client in the list. */
export function billableStripeIds(revenue: RevenueCustomerRow[]): string[] {
  const out = new Set<string>();
  for (const r of revenue) {
    if (r.billable === true && r.client_id && r.stripe_customer_id) out.add(r.stripe_customer_id);
  }
  return [...out];
}

export function deriveAccountArr(
  clientId: string | null | undefined,
  reads: ArrReads,
): AccountArrInfo {
  if (!reads.ok) return ARR_UNAVAILABLE;
  const rows = clientId ? billableRows(reads.revenue, clientId) : [];
  if (rows.length === 0) return { state: "not_billable" };
  const stripeIds = new Set(rows.map((r) => r.stripe_customer_id).filter((s): s is string => !!s));
  if (stripeIds.size === 0) return { state: "not_available" };
  // Two billable Stripe customers on one account: which deal is it? Do not guess.
  if (stripeIds.size > 1) return ARR_UNAVAILABLE;
  const [stripeId] = [...stripeIds];
  const deals = reads.deals.filter((d) => d.stripe_customer_id === stripeId);
  if (deals.length === 0) return { state: "not_available" };
  if (deals.length > 1) return ARR_UNAVAILABLE;
  const monthly = deals[0].monthly_total == null ? NaN : Number(deals[0].monthly_total);
  if (!Number.isFinite(monthly) || monthly <= 0) return ARR_UNAVAILABLE;
  return { state: "base_contract", arr: Math.round(monthly * 12) };
}

/** Text for a cell. null means show nothing meaningful (dash). */
export function arrText(
  account: Pick<Account, "arrInfo" | "arr">,
  formatMoney: (n: number) => string,
): string | null {
  const info = account.arrInfo;
  if (!info) return account.arr ? formatMoney(account.arr) : null;
  switch (info.state) {
    case "base_contract":
      return formatMoney(info.arr);
    case "unavailable":
      return "Unavailable";
    case "not_available":
      return "Not available";
    default:
      return null;
  }
}

/** Header line for the account detail page, or null to fall back to the ICP score. */
export function arrHeadline(
  account: Pick<Account, "arrInfo" | "arr">,
  formatMoney: (n: number) => string,
): string | null {
  const info = account.arrInfo;
  if (!info) return account.arr ? `${formatMoney(account.arr)} ARR` : null;
  switch (info.state) {
    case "base_contract":
      return `${formatMoney(info.arr)} base ARR`;
    case "unavailable":
      return "ARR unavailable";
    case "not_available":
      return "ARR not available";
    default:
      return null;
  }
}
