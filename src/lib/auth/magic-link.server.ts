/**
 * Server-only: passwordless magic-link + Better Auth session bridge.
 * Do not import from client components — use createServerFn wrappers in magic-link.ts.
 *
 * Redirect rules:
 *   - GoTrue takes `redirect_to` as a **query param** on `/auth/v1/otp`.
 *   - Production emails always use https://crm.rivvetai.com/auth/callback (no query
 *     string — query defaults on the callback route were 307-rewriting the URL and
 *     stripping the #access_token hash from Supabase).
 */
import { setCookie } from "@tanstack/react-start/server";
import {
  PLATFORM_SUPABASE_ANON_KEY,
  PLATFORM_SUPABASE_URL,
} from "@/lib/crm/wire/config";
import { auth, SESSION_TOKEN_COOKIE } from "./server";

export const DEFAULT_CRM_PUBLIC_ORIGIN = "https://crm.rivvetai.com";

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

function preferPreviewLink(): boolean {
  if (env("CRM_MAGIC_LINK_PREVIEW") === "1") return true;
  if (env("CRM_MAGIC_LINK_PREVIEW") === "0") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  return Boolean(serviceRoleKey());
}

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
  if (host.endsWith(".vercel.app") && host.includes("rivvet-crm")) return true;
  return false;
}

/**
 * Canonical callback path with NO query string.
 * Query defaults on the SPA route were causing a 307 that dropped #access_token.
 */
export function resolveMagicLinkRedirect(requestedRedirectTo: string): {
  redirectTo: string;
  rewritten: boolean;
  publicOrigin: string;
} {
  let requestedOrigin = "";
  try {
    requestedOrigin = new URL(requestedRedirectTo).origin;
  } catch {
    /* ignore */
  }

  const canonical = (
    firstEnv("CRM_PUBLIC_URL", "BETTER_AUTH_URL", "CRM_BASE_URL") ||
    DEFAULT_CRM_PUBLIC_ORIGIN
  ).replace(/\/$/, "");

  let origin = canonical;
  let rewritten = true;

  if (requestedOrigin) {
    let host = "";
    try {
      host = new URL(requestedOrigin).hostname;
    } catch {
      host = "";
    }
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (isLocal) {
      origin = requestedOrigin;
      rewritten = false;
    } else if (isTrustedCrmOrigin(requestedOrigin)) {
      origin = canonical;
      rewritten = requestedOrigin !== canonical;
    }
  }

  // No ?next= — destination after sign-in is hard-coded to /home in the callback.
  const redirectTo = `${origin}/auth/callback`;
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
      `Could not send sign-in link (${result.status})`;
    throw new Error(msg);
  }
}

async function generateMagicLink(
  email: string,
  redirectTo: string,
): Promise<string> {
  const key = serviceRoleKey();
  if (!key) throw new Error("Sign-in preview requires server configuration");
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
      `Could not create sign-in link (${result.status})`;
    throw new Error(msg);
  }
  const data = result.json as {
    action_link?: string;
    properties?: { action_link?: string };
  } | null;
  const link = data?.action_link || data?.properties?.action_link;
  if (!link) throw new Error("Could not create sign-in link");
  try {
    const u = new URL(link);
    if (u.searchParams.has("redirect_to")) {
      u.searchParams.set("redirect_to", redirectTo);
      return u.toString();
    }
  } catch {
    /* raw */
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
    throw new Error("Sign-in link expired or invalid — request a new one");
  }
  const user = result.json as { id?: string; email?: string } | null;
  if (!user?.id || !user.email) {
    throw new Error("Could not verify sign-in");
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
      /* optional */
    }
  }

  const session = await ctx.internalAdapter.createSession(userId);
  if (!session?.token) {
    throw new Error("Could not create session");
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
  redirectTo: string;
  rewritten: boolean;
};

export async function requestMagicLinkServer(input: {
  email: string;
  redirectTo: string;
}): Promise<RequestMagicLinkResult> {
  const resolved = resolveMagicLinkRedirect(input.redirectTo);
  console.info(
    `[auth] magic-link email=${input.email} redirect_to=${resolved.redirectTo}` +
      (resolved.rewritten ? " (canonical)" : ""),
  );

  if (preferPreviewLink() && serviceRoleKey()) {
    try {
      const previewUrl = await generateMagicLink(
        input.email,
        resolved.redirectTo,
      );
      return {
        ok: true,
        previewUrl,
        emailed: false,
        redirectTo: resolved.redirectTo,
        rewritten: resolved.rewritten,
      };
    } catch (err) {
      console.warn(
        "[auth] preview link failed, falling back to email:",
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
  // Try PKCE then authorization_code grant shapes GoTrue accepts
  const attempts: Array<{ path: string; body: Record<string, string> }> = [
    { path: "/auth/v1/token?grant_type=pkce", body: { auth_code: code } },
    {
      path: "/auth/v1/token?grant_type=authorization_code",
      body: { auth_code: code, code },
    },
  ];
  let accessToken: string | undefined;
  for (const attempt of attempts) {
    const result = await supabaseAuthFetch(attempt.path, {
      method: "POST",
      key: anonKey(),
      body: attempt.body,
    });
    if (result.ok) {
      accessToken = (result.json as { access_token?: string } | null)
        ?.access_token;
      if (accessToken) break;
    }
  }
  if (!accessToken) {
    throw new Error("Could not complete sign-in — request a new link");
  }
  return completeMagicLinkWithToken(accessToken);
}

/**
 * Email-template / older flows pass token_hash + type instead of access_token.
 * POST /auth/v1/verify exchanges them for a session.
 */
export async function completeMagicLinkWithTokenHash(input: {
  tokenHash: string;
  type?: string;
}) {
  const type = input.type || "magiclink";
  const result = await supabaseAuthFetch("/auth/v1/verify", {
    method: "POST",
    key: anonKey(),
    body: {
      type,
      token_hash: input.tokenHash,
    },
  });
  if (!result.ok) {
    // Some projects use type "email" for magic links
    if (type !== "email") {
      return completeMagicLinkWithTokenHash({
        tokenHash: input.tokenHash,
        type: "email",
      });
    }
    const msg =
      (result.json as { msg?: string; error_description?: string } | null)
        ?.error_description ||
      (result.json as { msg?: string } | null)?.msg ||
      "Sign-in link expired or invalid — request a new one";
    throw new Error(msg);
  }
  const accessToken = (result.json as { access_token?: string } | null)
    ?.access_token;
  if (!accessToken) {
    // verify may return { access_token } or nested session
    const nested = (
      result.json as { session?: { access_token?: string } } | null
    )?.session?.access_token;
    if (!nested) throw new Error("Could not complete sign-in");
    return completeMagicLinkWithToken(nested);
  }
  return completeMagicLinkWithToken(accessToken);
}
