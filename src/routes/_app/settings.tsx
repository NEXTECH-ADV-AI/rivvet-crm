import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/page-header";
import { useWireStatus } from "@/lib/crm/wire";
import { signOutFn } from "@/lib/auth/crm-session";
import { cn } from "@/components/ui/cn";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const { data: wire, isLoading, isError } = useWireStatus();
  const [signingOut, setSigningOut] = useState(false);
  const live = wire?.source === "live" && wire.connected;

  async function signOut() {
    setSigningOut(true);
    try {
      await signOutFn();
    } finally {
      // A full load drops every cached record along with the session.
      window.location.assign("/login");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Settings" />

      <section className="crm-surface flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="crm-label">Signed in as</p>
          <p className="truncate text-sm font-medium text-ink">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={signingOut}
          className="rounded-md border border-border-soft px-3 py-1.5 text-sm font-semibold transition hover:bg-mist active:scale-[0.98] disabled:opacity-40"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </section>

      <section className="crm-surface p-5">
        <p className="crm-label">Data</p>
        {isLoading ? (
          <p className="mt-1 text-sm text-fg-muted">Checking the connection…</p>
        ) : (
          <p className={cn("mt-1 text-sm font-medium", live ? "text-product-mint" : "text-warn")}>
            {live
              ? "Connected to live data."
              : isError
                ? "Couldn't check the connection. Refresh to try again."
                : "Not connected to live data. Every page will be empty until it is."}
          </p>
        )}
      </section>
    </div>
  );
}
