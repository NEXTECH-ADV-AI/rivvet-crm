import { test } from "node:test";
import assert from "node:assert/strict";
import { unavailableAccount, unavailableAccounts } from "./account-unavailable";
import { seedAccounts } from "../seed";

test("a failed live accounts list is zero rows with an unavailable message, never seed accounts", () => {
  assert.ok(seedAccounts.length > 0, "seed exists, so zero is a choice not an accident");
  const r = unavailableAccounts(50, 0, "accounts 500");
  assert.equal(r.accounts.length, 0);
  assert.equal(r.total, 0);
  assert.match(r.message, /unavailable/);
});

test("a failed live account detail read is null with no contacts", () => {
  const r = unavailableAccount("account 500");
  assert.equal(r.account, null);
  assert.deepEqual(r.contacts, []);
});
