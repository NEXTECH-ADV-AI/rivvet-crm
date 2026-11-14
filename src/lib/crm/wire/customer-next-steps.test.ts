import { test } from "node:test";
import assert from "node:assert/strict";
import { customerNextSteps } from "./hydrate-service.server";
import { seedAccounts } from "../seed";

test("customer task lookup is GET-only, exact-id scoped, and never calls a failed or truncated read missing work", async () => {
  const original = globalThis.fetch;
  const account = { ...seedAccounts[0], id: "11111111-1111-4111-8111-111111111111" };
  try {
    globalThis.fetch = (async (input, init) => {
      assert.equal(init?.method ?? "GET", "GET");
      assert.ok(String(input).includes(`account_id=in.(${account.id})`));
      return new Response(
        JSON.stringify([
          { account_id: account.id, title: "Confirm next visit", due_at: "2026-11-20T12:00:00Z" },
        ]),
        { headers: { "content-range": "0-0/1" } },
      );
    }) as typeof fetch;
    const [found] = await customerNextSteps([account]);
    assert.equal(found.nextAction, "Confirm next visit");
    assert.equal(found.nextActionKnown, true);
    globalThis.fetch = (async () =>
      new Response("[]", { headers: { "content-range": "*/1" } })) as typeof fetch;
    assert.equal((await customerNextSteps([account]))[0].nextActionKnown, false);
    globalThis.fetch = (async () => new Response("[]", { status: 503 })) as typeof fetch;
    assert.equal((await customerNextSteps([account]))[0].nextActionKnown, false);
    globalThis.fetch = (async () =>
      new Response("[]", { headers: { "content-range": "*/0" } })) as typeof fetch;
    const [empty] = await customerNextSteps([account]);
    assert.equal(empty.nextActionKnown, true);
    assert.equal(empty.nextAction, null);
  } finally {
    globalThis.fetch = original;
  }
});
