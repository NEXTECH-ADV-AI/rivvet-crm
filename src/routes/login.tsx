import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { requestMagicLink } from "@/lib/auth/client";
import { completeEmailCodeFn } from "@/lib/auth/magic-link";
import { listenForSignIn } from "@/lib/auth/auth-channel";
import { normalizeSignInCode } from "@/lib/auth/sign-in-input";
import { RivvetBrand } from "@/components/crm/logo";

export const Route = createFileRoute("/login")({ component: Login });

const goHome = () => window.location.replace("/home");

function Login() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (step !== previousStep.current || error) input.current?.focus();
    previousStep.current = step;
  }, [step, error]);

  // Tapping the email link signs in another tab; this tab follows it to Home (RIV-1544).
  useEffect(() => (step === "code" ? listenForSignIn(goHome) : undefined), [step]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError(null);
    setBusy(true);
    try {
      const result = await requestMagicLink(email, { callbackURL: "/home" });
      setPreviewUrl(result.previewUrl);
      setCode("");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the email. Try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError(null);
    setBusy(true);
    try {
      await completeEmailCodeFn({ data: { email, code } });
      goHome();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work. Try again.");
      pending.current = false;
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-md border border-border-soft bg-card px-3 py-3 text-base text-ink placeholder:text-fg-subtle transition focus:border-product-mint";
  const button =
    "flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <main className="grid min-h-dvh place-items-center bg-mist px-4 py-10">
      <div className="w-full max-w-sm">
        <RivvetBrand className="mb-6 justify-center" />
        <div className="crm-surface space-y-5 p-4 sm:p-6">
          <div>
            <p className="crm-label">Rivvet CRM</p>
            <h1 className="mt-1 text-xl font-semibold text-ink">
              {step === "email" ? "Sign in" : "Check your email"}
            </h1>
            <p className="mt-1 break-words text-sm text-fg-muted">
              {step === "email"
                ? "Use your Rivvet work email. We'll send you a sign-in code."
                : `We sent a code to ${email.trim()}. Type it here, or tap the button in the email.`}
            </p>
          </div>

          {step === "email" ? (
            <form onSubmit={send} aria-busy={busy} className="space-y-3">
              <label className="block space-y-1.5">
                <span className="crm-label">Work email</span>
                <input
                  ref={input}
                  readOnly={busy}
                  aria-invalid={!!error}
                  aria-describedby={error ? "sign-in-error" : undefined}
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="send"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@rivvetai.com"
                  className={field}
                />
              </label>
              <button type="submit" disabled={busy || !email.trim()} className={button}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {busy ? "Sending…" : "Email me a code"}
                {!busy && <ArrowRight className="size-4" aria-hidden />}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} aria-busy={busy} className="space-y-3">
              <label className="block space-y-1.5">
                <span className="crm-label">Sign-in code</span>
                <input
                  ref={input}
                  readOnly={busy}
                  aria-invalid={!!error}
                  aria-describedby={error ? "sign-in-error" : undefined}
                  enterKeyHint="go"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(normalizeSignInCode(e.target.value))}
                  onPaste={(e) => {
                    e.preventDefault();
                    if (!pending.current)
                      setCode(normalizeSignInCode(e.clipboardData.getData("text")));
                  }}
                  placeholder="12345678"
                  className={`${field} text-center font-mono text-lg tracking-[0.3em] tabular-nums`}
                />
              </label>
              <button type="submit" disabled={busy || code.length < 6} className={button}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <div className="flex flex-wrap justify-between gap-x-3 text-xs">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStep("email");
                    setError(null);
                  }}
                  className="min-h-11 text-fg-muted hover:text-ink disabled:opacity-50"
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send()}
                  className="min-h-11 font-semibold text-product-mint hover:underline disabled:opacity-50"
                >
                  Send a new code
                </button>
              </div>
              {previewUrl && (
                <a
                  href={previewUrl}
                  className="flex min-h-11 items-center justify-center text-center text-xs font-semibold text-product-mint hover:underline"
                >
                  Local dev: open the sign-in link
                </a>
              )}
            </form>
          )}

          <p role="status" aria-live="polite" className="sr-only">
            {busy
              ? step === "email"
                ? "Sending your sign-in code"
                : "Processing your sign-in request"
              : ""}
          </p>
          {error && (
            <p
              id="sign-in-error"
              role="alert"
              className="break-words rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-fg-subtle">
          Codes and links expire after 1 hour and work once.
        </p>
      </div>
    </main>
  );
}
