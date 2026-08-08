import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { GROK_PROVIDERS } from "./providers";
import {
  completeMagicLinkCodeFn,
  completeMagicLinkFn,
  completeMagicLinkTokenHashFn,
  requestMagicLinkFn,
} from "./magic-link";

/**
 * Better Auth client for this React SPA (browser-side).
 */
export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

export { GROK_PROVIDERS };

const BEARER_KEY = "grok-auth.bearer-token";

export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(BEARER_KEY);
  } catch {
    return null;
  }
}

function setBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(BEARER_KEY, token);
    else window.sessionStorage.removeItem(BEARER_KEY);
  } catch {
    /* ignore */
  }
}

function inLivePreview(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".grok-sandbox.com")
  );
}

type PopupMessage = {
  source: "grok-auth-popup";
  token: string | null;
  error?: string;
};

export async function signIn(
  providerId: string,
  opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  const callbackURL = opts.callbackURL ?? "/";
  const errorCallbackURL = opts.errorCallbackURL ?? "/";

  const popup = inLivePreview() ? openSignInPopup(providerId) : null;

  const hadBearer = Boolean(getBearerToken());
  if (hadBearer || !inLivePreview()) {
    try {
      await authClient.signOut();
    } catch {
      /* proceed */
    }
  }
  setBearerToken(null);

  if (inLivePreview()) {
    if (!popup) throw new Error("Pop-up blocked — allow pop-ups for sign-in");
    const token = await waitForPopupToken(popup);
    if (!token) throw new Error("Sign-in was cancelled or failed");
    setBearerToken(token);
    try {
      await authClient.getSession();
    } catch {
      /* ok */
    }
    if (typeof window !== "undefined") {
      const dest = new URL(callbackURL, window.location.origin);
      const here = window.location;
      if (
        dest.origin !== here.origin ||
        dest.pathname !== here.pathname ||
        dest.search !== here.search
      ) {
        window.location.href = callbackURL;
      }
    }
    return;
  }

  const { data, error } = await authClient.signIn.oauth2({
    providerId,
    callbackURL,
    errorCallbackURL,
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
  if (data?.url) window.location.href = data.url;
}

/**
 * Request a passwordless sign-in link.
 * redirect_to is always .../auth/callback with NO query string (hash-safe).
 */
export async function requestMagicLink(
  email: string,
  opts: { callbackURL?: string } = {},
): Promise<{
  previewUrl: string | null;
  emailed: boolean;
  redirectTo: string;
  rewritten: boolean;
}> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    throw new Error("Enter a valid work email");
  }
  void opts.callbackURL; // destination after auth is /home in the callback page
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : `https://crm.rivvetai.com/auth/callback`;

  const result = await requestMagicLinkFn({
    data: { email: trimmed, redirectTo },
  });
  return {
    previewUrl: result.previewUrl,
    emailed: result.emailed,
    redirectTo: result.redirectTo,
    rewritten: result.rewritten,
  };
}

export type MagicLinkCredentials = {
  accessToken?: string | null;
  code?: string | null;
  tokenHash?: string | null;
  type?: string | null;
};

/**
 * Finish sign-in after landing on /auth/callback.
 * Supports: #access_token (implicit), ?code= (PKCE), ?token_hash=&type= (email).
 */
export async function completeMagicLink(
  opts: MagicLinkCredentials,
): Promise<void> {
  let token: string | null = null;
  if (opts.accessToken) {
    const res = await completeMagicLinkFn({
      data: { accessToken: opts.accessToken },
    });
    token = res.token;
  } else if (opts.code) {
    const res = await completeMagicLinkCodeFn({ data: { code: opts.code } });
    token = res.token;
  } else if (opts.tokenHash) {
    const res = await completeMagicLinkTokenHashFn({
      data: {
        tokenHash: opts.tokenHash,
        type: opts.type ?? undefined,
      },
    });
    token = res.token;
  } else {
    throw new Error("Missing sign-in credentials");
  }

  if (token) {
    setBearerToken(token);
  }

  try {
    await authClient.getSession();
  } catch {
    /* ok */
  }
}

/**
 * Read Supabase credentials from the current URL (hash + query).
 * Call ASAP — before the router rewrites the location.
 */
export function readMagicLinkCredentialsFromUrl(): MagicLinkCredentials & {
  error?: string | null;
  errorDescription?: string | null;
} {
  if (typeof window === "undefined") return {};
  const hashRaw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hash = new URLSearchParams(hashRaw);
  const query = new URLSearchParams(window.location.search);
  const get = (key: string) => hash.get(key) || query.get(key);

  return {
    accessToken: get("access_token"),
    code: get("code"),
    tokenHash: get("token_hash"),
    type: get("type"),
    error: get("error"),
    errorDescription: get("error_description"),
  };
}

function openSignInPopup(providerId: string): Window | null {
  const origin = window.location.origin;
  const url = `${origin}/auth/popup?providerId=${encodeURIComponent(providerId)}`;
  const name = `grok-signin-${Date.now()}`;
  return window.open(url, name, "popup,width=500,height=650");
}

function waitForPopupToken(popup: Window): Promise<string | null> {
  return new Promise((resolve) => {
    const origin = window.location.origin;
    let settled = false;
    let closeTimer: number | undefined;
    const settle = (token: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(token);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as PopupMessage | undefined;
      if (!data || data.source !== "grok-auth-popup") return;
      settle(data.token ?? null);
    };
    const pollTimer = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(pollTimer);
      closeTimer = window.setTimeout(() => settle(null), 400);
    }, 300);
    function cleanup() {
      window.clearInterval(pollTimer);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      window.removeEventListener("message", onMessage);
    }
    window.addEventListener("message", onMessage);
  });
}

export async function signOut(redirectTo = "/"): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    setBearerToken(null);
  }
  window.location.href = redirectTo;
}
