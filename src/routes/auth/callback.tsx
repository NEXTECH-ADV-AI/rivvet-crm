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
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  completeMagicLink,
  readMagicLinkCredentialsFromUrl,
} from "@/lib/auth/client";
import { RivvetMark } from "@/components/crm/logo";

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

function AuthCallback() {
  const started = useRef(false);
  const [phase, setPhase] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const creds = captureCredentials() ?? readMagicLinkCredentialsFromUrl();

        if (creds.error || creds.errorDescription) {
          throw new Error(
            creds.errorDescription || creds.error || "Sign-in was denied",
          );
        }

        if (!creds.accessToken && !creds.code && !creds.tokenHash) {
          throw new Error(
            "No sign-in token found. Request a new link from the sign-in page.",
          );
        }

        await completeMagicLink({
          accessToken: creds.accessToken,
          code: creds.code,
          tokenHash: creds.tokenHash,
          type: creds.type,
        });

        try {
          window.sessionStorage.removeItem(CAPTURE_KEY);
        } catch {
          /* ignore */
        }

        setPhase("done");
        window.location.replace("/home");
      } catch (err) {
        setPhase("error");
        setError(err instanceof Error ? err.message : "Sign-in failed");
        try {
          window.sessionStorage.removeItem(CAPTURE_KEY);
        } catch {
          /* ignore */
        }
      }
    })();
  }, []);

  return (
    <main className="grid min-h-[calc(100dvh-var(--grok-banner-h,0px))] place-items-center bg-deep-ink px-4 py-10 text-white">
      <div className="w-full max-w-sm space-y-5 text-center">
        <div className="flex justify-center">
          <RivvetMark className="size-11" />
        </div>
        {phase === "working" && (
          <>
            <Loader2
              className="mx-auto size-6 animate-spin text-bright-mint"
              aria-hidden
            />
            <p className="font-display text-lg font-semibold">
              Signing you in…
            </p>
            <p className="text-sm text-white/55">One moment.</p>
          </>
        )}
        {phase === "done" && (
          <p className="text-sm text-bright-mint">Opening Rivvet CRM…</p>
        )}
        {phase === "error" && (
          <div className="space-y-4">
            <p className="font-display text-lg font-semibold text-red-200">
              Sign-in failed
            </p>
            <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error ?? "Unknown error"}
            </p>
            <a
              href="/login"
              className="inline-flex rounded-md bg-bright-mint px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.14em] text-deep-ink"
            >
              BACK TO SIGN IN
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
