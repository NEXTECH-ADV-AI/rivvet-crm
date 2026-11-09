/**
 * Account ARR rules (RIV-1942). Pure, shared by the server read and the UI.
 *
 * ARR here is base contract ARR only: the active contracted monthly base fee
 * times 12. Per-booking usage and RevShare are variable and never projected.
 * A customer counts as revenue only when public.revenue_customers says
 * billable (RIV-1937); an unregistered account has no ARR.
 */

import type { Account, AccountArrInfo } from "../types";

export type RevenueCustomerRow = {
  client_id: string | null;
  billable: boolean;
};

export type RateConfigRow = {
  client_id: string;
  base_fee_cents: number | string | null;
};

export type ArrReads =
  | { ok: true; revenue: RevenueCustomerRow[]; rates: RateConfigRow[] }
  | { ok: false };

export const ARR_UNAVAILABLE: AccountArrInfo = { state: "unavailable" };

/** Client ids the registry marks billable (any billable row makes the client billable). */
export function billableClientIds(revenue: RevenueCustomerRow[]): Set<string> {
  const out = new Set<string>();
  for (const r of revenue) {
    if (r.billable === true && r.client_id) out.add(r.client_id);
  }
  return out;
}

export function deriveAccountArr(
  clientId: string | null | undefined,
  reads: ArrReads,
): AccountArrInfo {
  if (!reads.ok) return ARR_UNAVAILABLE;
  if (!clientId || !billableClientIds(reads.revenue).has(clientId)) {
    return { state: "not_billable" };
  }
  const rate = reads.rates.find((r) => r.client_id === clientId);
  const cents = rate == null || rate.base_fee_cents == null ? NaN : Number(rate.base_fee_cents);
  if (!Number.isFinite(cents) || cents <= 0) return { state: "not_available" };
  return { state: "base_contract", arr: Math.round((cents * 12) / 100) };
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
