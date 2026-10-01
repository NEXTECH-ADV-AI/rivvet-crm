import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed CRM session token (RIV-1534). Stateless on purpose: production has
 * no DATABASE_URL, so Better Auth sessions lived in per-instance PGLite memory
 * and vanished on cold start. An HMAC-signed `email.expiry` token survives any
 * instance. Pure functions only, so `node --test` can exercise them.
 */

const DEFAULT_DOMAIN = "rivvetai.com";

/** Rivvet work emails only, plus any address named in CRM_ALLOWED_EMAILS. */
export function isAllowedEmail(email: string, extraCsv = ""): boolean {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(e)) return false;
  if (e.endsWith("@" + DEFAULT_DOMAIN)) return true;
  return extraCsv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(e);
}

function mac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signSession(email: string, expiresAtMs: number, secret: string): string {
  const body = Buffer.from(`${email.trim().toLowerCase()}|${expiresAtMs}`).toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

/** Returns the email when the token is authentic, unexpired and still allowed. */
export function verifySession(
  token: string | undefined,
  secret: string,
  nowMs: number,
  extraCsv = "",
): string | null {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body, secret));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const [email, exp] = Buffer.from(body, "base64url").toString("utf8").split("|");
  if (!email || !(Number(exp) > nowMs)) return null;
  return isAllowedEmail(email, extraCsv) ? email : null;
}
