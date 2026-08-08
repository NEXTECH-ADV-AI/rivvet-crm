import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import {
  GROK_PROVIDERS,
  authEnabled,
  signIn,
  requestMagicLink,
} from "@/lib/auth/client";
import { RivvetMark } from "@/components/crm/logo";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [redirectHint, setRedirectHint] = useState<string | null>(null);

  async function onMagicSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPreviewUrl(null);
    setEmailed(false);
    setRedirectHint(null);
    setStatus("sending");
    try {
      const result = await requestMagicLink(email, { callbackURL: "/home" });
      setPreviewUrl(result.previewUrl);
      setEmailed(result.emailed);
      if (result.rewritten || result.emailed) {
        try {
          setRedirectHint(new URL(result.redirectTo).origin);
        } catch {
          setRedirectHint(result.redirectTo);
        }
      }
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not send magic link");
    }
  }

  return (
    <main className="grid min-h-[calc(100dvh-var(--grok-banner-h,0px))] place-items-center bg-deep-ink px-4 py-10 text-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <RivvetMark className="size-11" />
          <div>
            <p className="font-display text-[10px] font-semibold tracking-[0.16em] text-bright-mint">
              SIGN IN
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Rivvet CRM.
            </h1>
          </div>
        </div>
        <p className="text-sm text-white/60">
          Work email magic link (Supabase → Resend). Lands on this CRM — not
          app.rivvetai.com. Platform Google / X optional.
        </p>

        {/* Magic link is the primary Rivvet operator path — always shown */}
        <form onSubmit={onMagicSubmit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="font-mono text-[10px] tracking-wider text-white/40">
              WORK EMAIL
            </span>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35"
                aria-hidden
              />
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "sent" || status === "error") setStatus("idle");
                }}
                placeholder="you@rivvetai.com"
                className="w-full rounded-md border border-white/15 bg-white/5 py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-bright-mint/50 focus:bg-white/8"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={status === "sending" || !email.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-bright-mint px-4 py-3 font-mono text-[11px] font-bold tracking-[0.14em] text-deep-ink transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "sending" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                SENDING LINK…
              </>
            ) : (
              <>
                EMAIL ME A MAGIC LINK
                <ArrowRight className="size-3.5" aria-hidden />
              </>
            )}
          </button>

          {status === "sent" && (
            <div className="space-y-2 rounded-md border border-bright-mint/25 bg-bright-mint/10 px-3 py-3 text-sm">
              <p className="flex items-start gap-2 text-bright-mint">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {previewUrl
                    ? "Link ready (sandbox preview — no email hop)."
                    : emailed
                      ? `Check ${email.trim()} — Supabase emailed your link via Resend.`
                      : `Check ${email.trim()} for your sign-in link.`}
                </span>
              </p>
              {redirectHint && !previewUrl && (
                <p className="text-xs text-white/55">
                  After you click the email, you should land on{" "}
                  <span className="font-mono text-white/80">{redirectHint}</span>
                  {" "}→ /auth/callback. If you still hit app.rivvetai.com, the
                  new deploy may not be live yet.
                </p>
              )}
              {previewUrl && (
                <a
                  href={previewUrl}
                  className="block rounded-md border border-bright-mint/40 bg-deep-ink/40 px-3 py-2.5 text-center font-mono text-[11px] font-bold tracking-[0.12em] text-bright-mint transition hover:bg-deep-ink/70"
                >
                  OPEN MAGIC LINK →
                </a>
              )}
            </div>
          )}

          {status === "error" && error && (
            <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
        </form>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-deep-ink px-3 font-mono text-[9px] tracking-[0.16em] text-white/35">
              OR
            </span>
          </div>
        </div>

        <Link
          to="/home"
          className="flex w-full items-center justify-center rounded-md border border-white/15 bg-white/5 px-4 py-3 font-mono text-[11px] font-bold tracking-[0.14em] text-white/90 transition hover:bg-white/10"
        >
          ENTER CRM SANDBOX
        </Link>

        {authEnabled && (
          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="font-mono text-[10px] tracking-wider text-white/40">
              PLATFORM AUTH
            </p>
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/home" })}
                className="w-full rounded-md border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white/90 hover:bg-white/10"
              >
                Continue with {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
