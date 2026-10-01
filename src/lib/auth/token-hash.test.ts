import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTokenHash } from "./token-hash";

const HASH = "c6fa7a089872bda0f7ed374580f510aefdfa86c6d7c29bf7335c4499";

test("strips the quoted-printable 3D glued to the token", () => {
  assert.equal(HASH.length, 56);
  assert.equal(normalizeTokenHash("3D" + HASH), HASH);
});

test("leaves a clean token and anything else alone", () => {
  assert.equal(normalizeTokenHash(HASH), HASH);
  assert.equal(normalizeTokenHash("3d" + HASH.slice(2)), "3d" + HASH.slice(2));
  assert.equal(normalizeTokenHash("pkce_abc"), "pkce_abc");
});
