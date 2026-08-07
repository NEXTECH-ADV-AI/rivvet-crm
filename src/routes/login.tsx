import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { RivvetMark } from "@/components/crm/logo";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
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
          Preview sandbox. Enter the operator CRM with mock data, or use
          platform sign-in when enabled.
        </p>

        <Link
          to="/home"
          className="flex w-full items-center justify-center rounded-md bg-bright-mint px-4 py-3 font-mono text-[11px] font-bold tracking-[0.14em] text-deep-ink transition hover:brightness-105"
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
