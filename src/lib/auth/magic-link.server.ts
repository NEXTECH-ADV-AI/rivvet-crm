/**
 * Server-only: Supabase Auth magic-link + Better Auth session bridge.
 * Do not import from client components — use createServerFn wrappers in magic-link.ts.
 *
 * Redirect rules (why links used to open app.rivvetai.com):
 *   - GoTrue takes `redirect_to` as a **query param** on `/auth/v1/otp`, not a
 *     body field. Missing/invalid redirects fall back to the project Site URL
 *     (currently app.rivvetai.com — the old app).
 *   - Sandbox / unknown origins are rewritten to the rivvet-crm public URL so
 *     emailed links always land on this CRM, not Site URL.
 */
import { setCookie } from "@tanstack/react-start/server";
import {
  PLATFORM_SUPABASE_ANON_KEY,
  PLATFORM_SUPABASE_URL,
} from "@/lib/crm/wire/config";
import { auth, SESSION_TOKEN_COOKIE } from "./server";

/** Live sibling deploy — default destination for magic links from sandbox. */
export const DEFAULT_CRM_PUBLIC_ORIGIN =
  "https://rivvet-crm-rivvetai.vercel.app";

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v ? v : undefined;
}

function firstEnv(...keys: string[]): string {
  for (const k of keys) {
    const v = env(k);
    if (v) return v;
  }
  return "";
}

function supabaseUrl(): string {
  return (
    firstEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_URL",
      "CRM_SUPABASE_URL",
      "VITE_SUPABASE_URL",
    ) || PLATFORM_SUPABASE_URL
  ).replace(/\/$/, "");
}

function anonKey(): string {
  return (
    firstEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY",
      "CRM_SUPABASE_ANON_KEY",
    ) || PLATFORM_SUPABASE_ANON_KEY
  );
}

function serviceRoleKey(): string {
  return firstEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRM_SUPABASE_SERVICE_ROLE_KEY",
  );
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "Operator";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Prefer generating a preview link when we have service_role and are not on
 * Vercel production — operators can finish sign-in without inbox access.
 * On Vercel production we always send email via Supabase → Resend.
 */
function preferPreviewLink(): boolean {
  if (env("CRM_MAGIC_LINK_PREVIEW") === "1") return true;
  if (env("CRM_MAGIC_LINK_PREVIEW") === "0") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  return Boolean(serviceRoleKey());
}

/** Origins we are willing to put in the email (must also be in Supabase allowlist). */
function isTrustedCrmOrigin(origin: string): boolean {
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    return true;
  }
  if (host === "crm.rivvetai.com") return true;
  // This project's Vercel hosts only — not app.rivvetai.com / other products
  if (host.endsWith(".vercel.app") && host.includes("rivvet-crm")) return true;
  return false;
}

/**
 * Resolve where Supabase should send the operator after they click the email.
 * Never fall through to Supabase Site URL (app.rivvetai.com).
 */
export function resolveMagicLinkRedirect(requestedRedirectTo: string): {
  redirectTo: string;
  rewritten: boolean;
  publicOrigin: string;
} {
  let next = "/home";
  let requestedOrigin = "";
  try {
    const u = new URL(requestedRedirectTo);
    requestedOrigin = u.origin;
    const n = u.searchParams.get("next");
    if (n && n.startsWith("/")) next = n;
  } catch {
    /* ignore — use defaults */
  }

  const configured =
    firstEnv("CRM_PUBLIC_URL", "BETTER_AUTH_URL") ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    DEFAULT_CRM_PUBLIC_ORIGIN;

  const publicOrigin = configured.replace(/\/$/, "");

  let origin = publicOrigin;
  let rewritten = true;
  if (requestedOrigin && isTrustedCrmOrigin(requestedOrigin)) {
    origin = requestedOrigin;
    rewritten = origin !== requestedOrigin;
  }

  // Path only + next query — allowlist both exact and /** in Supabase
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  return { redirectTo, rewritten, publicOrigin: origin };
}

async function supabaseAuthFetch(
  path: string,
  init: {
    method: string;
    body?: unknown;
    key: string;
    accessToken?: string;
  },
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const headers: Record<string, string> = {
    apikey: init.key,
    Authorization: `Bearer ${init.accessToken ?? init.key}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(`${supabaseUrl()}${path}`, {
    method: init.method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

/**
 * Ask Supabase to email a magic link (Resend lives in Supabase).
 * `redirect_to` MUST be a query param — body fields are ignored by GoTrue.
 */
async function sendOtpEmail(email: string, redirectTo: string): Promise<void> {
  const qs = new URLSearchParams({ redirect_to: redirectTo });
  const result = await supabaseAuthFetch(`/auth/v1/otp?${qs.toString()}`, {
    method: "POST",
    key: anonKey(),
    body: {
      email,
      create_user: true,
      data: {},
      gotrue_meta_security: {},
    },
  });
  if (!result.ok) {
    const msg =
      (result.json as { error_description?: string; msg?: string; error?: string } | null)
        ?.error_description ||
      (result.json as { msg?: string } | null)?.msg ||
      (result.json as { error?: string } | null)?.error ||
      result.text.slice(0, 200) ||
      `OTP failed (${result.status})`;
    throw new Error(msg);
  }
}

async function generateMagicLink(
  email: string,
  redirectTo: string,
): Promise<string> {
  const key = serviceRoleKey();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY required for preview link");
  // Admin API: redirect_to in body.options (different from OTP query param)
  const result = await supabaseAuthFetch("/auth/v1/admin/generate_link", {
    method: "POST",
    key,
    body: {
      type: "magiclink",
      email,
      options: { redirect_to: redirectTo },
      redirect_to: redirectTo,
    },
  });
  if (!result.ok) {
    const msg =
      (result.json as { msg?: string; error?: string } | null)?.msg ||
      (result.json as { error?: string } | null)?.error ||
      result.text.slice(0, 200) ||
      `generate_link failed (${result.status})`;
    throw new Error(msg);
  }
  const data = result.json as {
    action_link?: string;
    properties?: { action_link?: string; redirect_to?: string };
    redirect_to?: string;
  } | null;
  const link = data?.action_link || data?.properties?.action_link;
  if (!link) throw new Error("Supabase did not return an action_link");
  // Harden: if GoTrue still baked Site URL, force our redirect_to on the verify URL
  try {
    const u = new URL(link);
    if (u.searchParams.has("redirect_to")) {
      u.searchParams.set("redirect_to", redirectTo);
      return u.toString();
    }
  } catch {
    /* return raw link */
  }
  return link;
}

async function verifySupabaseAccessToken(accessToken: string): Promise<{
  id: string;
  email: string;
}> {
  const result = await supabaseAuthFetch("/auth/v1/user", {
    method: "GET",
    key: anonKey(),
    accessToken,
  });
  if (!result.ok) {
    throw new Error("Magic link expired or invalid — request a new one");
  }
  const user = result.json as { id?: string; email?: string } | null;
  if (!user?.id || !user.email) {
    throw new Error("Supabase user missing email");
  }
  return { id: user.id, email: user.email.trim().toLowerCase() };
}

async function establishAppSession(supabaseUser: {
  id: string;
  email: string;
}): Promise<{ token: string; userId: string; email: string; name: string }> {
  const ctx = await auth.$context;
  const email = supabaseUser.email.trim().toLowerCase();
  const name = displayNameFromEmail(email);

  const existing = await ctx.internalAdapter.findUserByEmail(email);
  let userId: string;
  if (existing?.user?.id) {
    userId = existing.user.id;
    if (!existing.user.emailVerified) {
      await ctx.internalAdapter.updateUser(userId, { emailVerified: true });
    }
  } else {
    const created = await ctx.internalAdapter.createUser({
      email,
      name,
      emailVerified: true,
    });
    userId = created.id;
    try {
      await ctx.internalAdapter.createAccount({
        userId,
        providerId: "supabase",
        accountId: supabaseUser.id,
      });
    } catch {
      // Account row is optional metadata — session still works without it.
    }
  }

  const session = await ctx.internalAdapter.createSession(userId);
  if (!session?.token) {
    throw new Error("Could not create app session");
  }

  setCookie(SESSION_TOKEN_COOKIE, session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return { token: session.token, userId, email, name };
}

export type RequestMagicLinkResult = {
  ok: true;
  previewUrl: string | null;
  emailed: boolean;
  /** Final redirect target baked into the email (for UI copy). */
  redirectTo: string;
  /** True when we rewrote sandbox/unknown origin → rivvet-crm public URL. */
  rewritten: boolean;
};

export async function requestMagicLinkServer(input: {
  email: string;
  redirectTo: string;
}): Promise<RequestMagicLinkResult> {
  const resolved = resolveMagicLinkRedirect(input.redirectTo);
  console.info(
    `[magic-link] email=${input.email} redirect_to=${resolved.redirectTo}` +
      (resolved.rewritten ? " (rewrote untrusted origin)" : ""),
  );

  if (preferPreviewLink() && serviceRoleKey()) {
    try {
      const previewUrl = await generateMagicLink(
        input.email,
        resolved.redirectTo,
      );
      console.info(`[magic-link] preview action_link for ${input.email}`);
      return {
        ok: true,
        previewUrl,
        emailed: false,
        redirectTo: resolved.redirectTo,
        rewritten: resolved.rewritten,
      };
    } catch (err) {
      console.warn(
        "[magic-link] generate_link failed, falling back to OTP email:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  await sendOtpEmail(input.email, resolved.redirectTo);
  return {
    ok: true,
    previewUrl: null,
    emailed: true,
    redirectTo: resolved.redirectTo,
    rewritten: resolved.rewritten,
  };
}

export async function completeMagicLinkWithToken(accessToken: string) {
  const sbUser = await verifySupabaseAccessToken(accessToken);
  const session = await establishAppSession(sbUser);
  return {
    ok: true as const,
    token: session.token,
    email: session.email,
    name: session.name,
  };
}

export async function completeMagicLinkWithCode(code: string) {
  const result = await supabaseAuthFetch("/auth/v1/token?grant_type=pkce", {
    method: "POST",
    key: anonKey(),
    body: { auth_code: code },
  });
  let accessToken: string | undefined;
  if (result.ok) {
    accessToken = (result.json as { access_token?: string } | null)?.access_token;
  } else {
    const alt = await supabaseAuthFetch(
      "/auth/v1/token?grant_type=authorization_code",
      {
        method: "POST",
        key: anonKey(),
        body: { auth_code: code, code },
      },
    );
    if (!alt.ok) {
      throw new Error("Could not exchange magic-link code — request a new link");
    }
    accessToken = (alt.json as { access_token?: string } | null)?.access_token;
  }
  if (!accessToken) throw new Error("No access token from Supabase");
  return completeMagicLinkWithToken(accessToken);
}
