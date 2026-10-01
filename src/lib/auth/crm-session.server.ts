import { createHmac, randomBytes } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { isAllowedEmail, signSession, verifySession } from "./crm-session-token";

export const CRM_SESSION_COOKIE = "rivvet_crm_session";
const MAX_AGE_S = 60 * 60 * 24 * 7;

const globalRef = globalThis as typeof globalThis & { __crmDevSessionSecret__?: string };

/**
 * Derived from the service role key so every instance agrees without a new env
 * var; rotating that key signs everyone out. Off Vercel with no key (local dev),
 * a per-process random secret.
 */
function secret(): string {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.CRM_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (key) return createHmac("sha256", key).update("rivvet-crm-session-v1").digest("hex");
  if (process.env.VERCEL) throw new Error("CRM session secret unavailable");
  globalRef.__crmDevSessionSecret__ ??= randomBytes(32).toString("hex");
  return globalRef.__crmDevSessionSecret__;
}

const extra = () => process.env.CRM_ALLOWED_EMAILS ?? "";

export function crmEmailAllowed(email: string): boolean {
  return isAllowedEmail(email, extra());
}

export function startCrmSession(email: string): void {
  setCookie(CRM_SESSION_COOKIE, signSession(email, Date.now() + MAX_AGE_S * 1000, secret()), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export function readCrmSession(): { email: string } | null {
  const email = verifySession(getCookie(CRM_SESSION_COOKIE), secret(), Date.now(), extra());
  return email ? { email } : null;
}

export function endCrmSession(): void {
  deleteCookie(CRM_SESSION_COOKIE, { path: "/" });
}
