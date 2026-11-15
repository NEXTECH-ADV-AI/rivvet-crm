import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSignInCode } from "./sign-in-input";

test("copied codes preserve every digit before applying the input limit", () => {
  assert.equal(normalizeSignInCode("12 34 56 78 90"), "1234567890");
  assert.equal(normalizeSignInCode("1234-5678\n"), "12345678");
  assert.equal(normalizeSignInCode(" 012345 "), "012345");
});

test("autofill, incomplete input and oversized paste retain the existing 10 digit limit", () => {
  for (const code of ["", "1", "123456", "12345678", "1234567890"]) {
    assert.equal(normalizeSignInCode(code), code);
  }
  assert.equal(normalizeSignInCode("123456789012"), "1234567890");
  assert.equal(normalizeSignInCode("no code"), "");
});
