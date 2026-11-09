/**
 * Account ARR (RIV-1942): the database is the truth. A client is billable when
 * public.revenue_customers says so; its ARR is its deal's monthly_total x 12.
 * Usage and RevShare are variable and never projected.
 */

import type { Account, AccountArrInfo } from "../types";

/** client_id -> base ARR (NaN when its deal is missing or ambiguous), or null when the read failed. */
export type ArrByClient = Map<string, number> | null;

export function arrFor(clientId: string | null | undefined, byClient: ArrByClient): AccountArrInfo {
  if (!byClient) return { state: "unavailable" };
  const arr = clientId ? byClient.get(clientId) : undefined;
  if (arr === undefined) return { state: "not_billable" };
  return Number.isFinite(arr) && arr > 0 ? { state: "base_contract", arr } : { state: "unavailable" };
}

/** Text for a cell; null shows a dash. */
export function arrText(a: Pick<Account, "arrInfo" | "arr">, fmt: (n: number) => string): string | null {
  if (!a.arrInfo) return a.arr ? fmt(a.arr) : null;
  if (a.arrInfo.state === "base_contract") return fmt(a.arrInfo.arr);
  return a.arrInfo.state === "unavailable" ? "Unavailable" : null;
}

/** Account page headline, or null to fall back to the ICP score. */
export function arrHeadline(a: Pick<Account, "arrInfo" | "arr">, fmt: (n: number) => string): string | null {
  if (!a.arrInfo) return a.arr ? `${fmt(a.arr)} ARR` : null;
  const text = arrText(a, fmt);
  if (text === null) return null;
  return text === "Unavailable" ? "ARR unavailable" : `${text} base ARR`;
}
