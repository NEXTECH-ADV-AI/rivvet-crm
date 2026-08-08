/**
 * Supabase magic-link landing page.
 *
 * Supabase (via Resend) emails a link that redirects here with either:
 *   - hash: #access_token=…&refresh_token=…&type=magiclink
 *   - query: ?code=…  (PKCE)
 *
 * We exchange that for a Better Auth session, then send the operator home.
 */
import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { completeMagicLink } from "@/lib/auth/client";
import { RivvetMark } from "@/components/crm/logo";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : "/home",
    code: typeof search.code === "string" ? search.code : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    error_description:
      typeof search.error_description === "string"
        ? search.error_description
        : undefined,
  }),
});

function AuthCallback() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [error, setError] = useState<string | null>(
    search.error_description || search.error || null,
  );
  const [phase, setPhase] = useState<"working" | "done" | "error">(
    search.error ? "error" : "working",
  );

  useEffect(() => {
    if (search.error) return;
    let cancelled = false;

    (async () => {
      try {
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const params = new URLSearchParams(
          hash.startsWith("#") ? hash.slice(1) : hash,
        );
        const accessToken = params.get("access_token");
        const code = search.code ?? params.get("code");

        if (!accessToken && !code) {
          throw new Error(
            "No magic-link token found. Request a new link from the sign-in page.",
          );
        }

        await completeMagicLink({ accessToken, code });
        if (cancelled) return;
        setPhase("done");
        // Clear tokens from the URL bar before navigating.
        const next = search.next.startsWith("/") ? search.next : "/home";
        window.location.replace(next);
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setError(err instanceof Error ? err.message : "Sign-in failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [search.code, search.error, search.next, navigate]);

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
            <p className="text-sm text-white/55">
              Verifying your Supabase magic link.
            </p>
          </>
        )}
        {phase === "done" && (
          <p className="text-sm text-bright-mint">Redirecting to CRM…</p>
        )}
        {phase === "error" && (
          <div className="space-y-4">
            <p className="font-display text-lg font-semibold text-red-200">
              Magic link failed
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
