/**
 * What a failed live accounts read returns (RIV-1940). Zero rows and a visible
 * message: a live deploy never answers with the demo accounts.
 */

import type { Account, Contact } from "../types";

export function unavailableAccounts(
  limit: number,
  offset: number,
  reason: string,
): {
  source: "mock";
  accounts: Account[];
  total: number;
  limit: number;
  offset: number;
  message: string;
} {
  return {
    source: "mock",
    accounts: [],
    total: 0,
    limit,
    offset,
    message: `LIVE failed (${reason}): accounts unavailable.`,
  };
}

export function unavailableAccount(reason: string): {
  source: "mock";
  account: null;
  contacts: Contact[];
  message: string;
} {
  return { source: "mock", account: null, contacts: [], message: reason };
}
