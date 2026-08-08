/**
 * Passwordless magic-link via Supabase Auth (Resend is configured inside Supabase).
 *
 * Server implementation lives in `magic-link.server.ts` so the client never
 * pulls Better Auth server / pg. These createServerFn wrappers are safe to
 * import from the browser.
 */
import { createServerFn } from "@tanstack/react-start";

export const magicLinkEnabled = true;

export type RequestMagicLinkResult = {
  ok: true;
  /** Present when sandbox preview path generated the link (no email sent). */
  previewUrl: string | null;
  /** True when Supabase emailed the link via Resend. */
  emailed: boolean;
  /** Final redirect baked into the email. */
  redirectTo: string;
  /** True when sandbox/unknown origin was rewritten to rivvet-crm. */
  rewritten: boolean;
};

/**
 * Client-callable: start magic-link sign-in.
 * - Production (Vercel): Supabase sends email (Resend inside Supabase).
 * - Sandbox with service_role: returns action_link for in-UI open.
 * - Untrusted origins (e.g. grok sandbox) rewrite redirect → rivvet-crm deploy
 *   so Supabase does not fall back to Site URL (app.rivvetai.com).
 */
export const requestMagicLinkFn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; redirectTo: string }) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase();
    const redirectTo = String(input?.redirectTo ?? "").trim();
    if (!email || !email.includes("@")) {
      throw new Error("Enter a valid work email");
    }
    if (!redirectTo || !/^https?:\/\//i.test(redirectTo)) {
      throw new Error("Invalid redirect URL");
    }
    return { email, redirectTo };
  })
  .handler(async ({ data }): Promise<RequestMagicLinkResult> => {
    if (!magicLinkEnabled) throw new Error("Magic link is disabled");
    const { requestMagicLinkServer } = await import("./magic-link.server");
    return requestMagicLinkServer(data);
  });

/**
 * Client-callable after Supabase redirects to /auth/callback with tokens.
 * Verifies the Supabase JWT, mints a Better Auth session cookie, returns
 * bearer token for live-preview (partitioned cookies).
 */
export const completeMagicLinkFn = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => {
    const accessToken = String(input?.accessToken ?? "").trim();
    if (!accessToken) throw new Error("Missing access token");
    return { accessToken };
  })
  .handler(async ({ data }) => {
    const { completeMagicLinkWithToken } = await import("./magic-link.server");
    return completeMagicLinkWithToken(data.accessToken);
  });

/**
 * Exchange a Supabase auth `code` (PKCE) for a session, then mint app session.
 */
export const completeMagicLinkCodeFn = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => {
    const code = String(input?.code ?? "").trim();
    if (!code) throw new Error("Missing auth code");
    return { code };
  })
  .handler(async ({ data }) => {
    const { completeMagicLinkWithCode } = await import("./magic-link.server");
    return completeMagicLinkWithCode(data.code);
  });
