/**
 * Magic-link landing page.
 *
 * Supabase redirects here with credentials in either:
 *   - hash:  #access_token=…&refresh_token=…&type=magiclink
 *   - query: ?code=…  (PKCE)
 *   - query: ?token_hash=…&type=magiclink|email
 *
 * IMPORTANT: Do NOT default/rewrite search params on this route. A 307 to add
 * `?next=/home` was stripping the #access_token fragment and causing
 * "No sign-in token found".
 */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  completeMagicLink,
  readMagicLinkCredentialsFromUrl,
} from "@/lib/auth/client";
import { RivvetBrand } from "@/components/crm/logo";
import { announceSignIn } from "@/lib/auth/auth-channel";

const CAPTURE_KEY = "rivvet.auth.callback.creds";

/** Snapshot credentials before the router can touch the URL. */
function captureCredentials() {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.sessionStorage.getItem(CAPTURE_KEY);
    if (existing) {
      return JSON.parse(existing) as ReturnType<
        typeof readMagicLinkCredentialsFromUrl
      >;
    }
  } catch {
    /* fall through */
  }
  const creds = readMagicLinkCredentialsFromUrl();
  if (
    creds.accessToken ||
    creds.code ||
    creds.tokenHash ||
    creds.error
  ) {
    try {
      window.sessionStorage.setItem(CAPTURE_KEY, JSON.stringify(creds));
    } catch {
      /* ignore */
    }
    // Strip secrets from the address bar without a navigation that drops them
    // before we've read them (replaceState keeps us on /auth/callback).
    try {
      window.history.replaceState(null, "", "/auth/callback");
    } catch {
      /* ignore */
    }
  }
  return creds;
}

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
  // No validateSearch defaults — defaults caused a 307 that ate the hash.
});

type Outcome = "done" | "handoff";

/** Once per page load, not per mount: the router can remount this route after
 *  hydration, and a second run found the token already spent ("No sign-in
 *  token found") while the first had signed in (RIV-1545). */
let signIn: Promise<Outcome> | null = null;

async function runSignIn(): Promise<Outcome> {
  try {
    const creds = captureCredentials() ?? readMagicLinkCredentialsFromUrl();
    if (creds.error || creds.errorDescription) {
      throw new Error(creds.errorDescription || creds.error || "Sign-in was denied");
    }
    if (!creds.accessToken && !creds.code && !creds.tokenHash) {
      throw new Error("No sign-in token found. Request a new link from the sign-in page.");
    }
    await completeMagicLink({
      accessToken: creds.accessToken,
      code: creds.code,
      tokenHash: creds.tokenHash,
      type: creds.type,
    });
    // The tab that asked for the link takes over; this one only says so (RIV-1544).
    return (await announceSignIn()) ? "handoff" : "done";
  } finally {
    try {
      window.sessionStorage.removeItem(CAPTURE_KEY);
    } catch {
      /* ignore */
    }
  }
}

function AuthCallback() {
  const [phase, setPhase] = useState<"working" | Outcome | "error">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    signIn ??= runSignIn();
    signIn.then(
      (outcome) => {
        if (!live) return;
        setPhase(outcome);
        if (outcome === "handoff") window.close(); // only where the browser allows it; the message covers the rest
        else window.location.replace("/home");
      },
      (err: unknown) => {
        if (!live) return;
        setPhase("error");
        setError(err instanceof Error ? err.message : "Sign-in failed");
      },
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-mist px-4 py-10">
      <div className="w-full max-w-sm space-y-5 text-center">
        <RivvetBrand className="justify-center" />
        <div className="crm-surface space-y-3 p-6">
          {phase === "working" && (
            <>
              <Loader2 className="mx-auto size-6 animate-spin text-product-mint" aria-hidden />
              <p className="text-lg font-semibold text-ink">Signing you in to Rivvet CRM…</p>
            </>
          )}
          {phase === "done" && <p className="text-sm text-product-mint">Opening Rivvet CRM…</p>}
          {phase === "handoff" && (
            <>
              <p className="text-lg font-semibold text-ink">You're signed in</p>
              <p className="text-sm text-fg-muted">Rivvet CRM opened in the tab where you asked for the code. You can close this tab.</p>
              <a href="/home" className="inline-block text-sm font-semibold text-product-mint hover:underline">
                Or keep working here
              </a>
            </>
          )}
          {phase === "error" && (
            <>
              <p className="text-lg font-semibold text-ink">Sign-in didn't work</p>
              <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {error ?? "Unknown error"}
              </p>
              <a href="/login" className="inline-flex rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/90">
                Back to sign in
              </a>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
