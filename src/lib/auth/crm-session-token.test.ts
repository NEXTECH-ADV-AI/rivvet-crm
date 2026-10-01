import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedEmail, signSession, verifySession } from "./crm-session-token";

const S = "test-secret";
const NOW = 1_800_000_000_000;

test("only Rivvet work emails and named extras are allowed", () => {
  assert.equal(isAllowedEmail("Will@RivvetAI.com"), true);
  assert.equal(isAllowedEmail("someone@gmail.com"), false);
  assert.equal(isAllowedEmail("x@rivvetai.com.evil.io"), false);
  assert.equal(isAllowedEmail("x@evilrivvetai.com"), false);
  assert.equal(isAllowedEmail("partner@acme.com", "partner@acme.com, other@x.io"), true);
  assert.equal(isAllowedEmail("not-an-email"), false);
});

test("a signed session verifies until it expires", () => {
  const t = signSession("brayden@rivvetai.com", NOW + 1000, S);
  assert.equal(verifySession(t, S, NOW), "brayden@rivvetai.com");
  assert.equal(verifySession(t, S, NOW + 1001), null);
});

test("a forged, re-signed or non-Rivvet session is rejected", () => {
  const t = signSession("brayden@rivvetai.com", NOW + 1000, S);
  assert.equal(verifySession(t, "other-secret", NOW), null);
  const [, sig] = t.split(".");
  const forgedBody = Buffer.from(`attacker@gmail.com|${NOW + 1000}`).toString("base64url");
  assert.equal(verifySession(`${forgedBody}.${sig}`, S, NOW), null);
  assert.equal(verifySession(signSession("attacker@gmail.com", NOW + 1000, S), S, NOW), null);
  assert.equal(verifySession(undefined, S, NOW), null);
  assert.equal(verifySession("garbage", S, NOW), null);
});
