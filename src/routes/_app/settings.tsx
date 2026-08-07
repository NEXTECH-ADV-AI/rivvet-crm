import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/page-header";
import { RivvetBrand } from "@/components/crm/logo";
import { useWireStatus } from "@/lib/crm/wire";
import { SEQUENCE_SQL } from "@/lib/crm/sequence-queries";
import { cn } from "@/components/ui/cn";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const BUILD_ROWS: { label: string; value: string }[] = [
  { label: "Framework", value: "Vite (not Next.js)" },
  { label: "Build", value: "npm run build" },
  { label: "Output", value: "auto · Nitro .vercel/output" },
  { label: "Install", value: "npm install" },
  { label: "Node", value: "22.x" },
  { label: "Region", value: "sfo1" },
];

function SettingsPage() {
  const { data: wire, isLoading } = useWireStatus();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Data plane + Vercel build for crm-rivvetai. Instantly load + contract send stay locked."
      />

      <div className="crm-surface space-y-3 p-5">
        <p className="crm-label">Vercel build (crm-rivvetai)</p>
        <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
          {BUILD_ROWS.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]"
            >
              <span className="text-fg-muted">{r.label}</span>
              <span className="font-mono text-[11px] font-medium text-ink">
                {r.value}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-fg-subtle">
          Source of truth:{" "}
          <code className="font-mono text-[10px]">vercel.json</code> · never set
          Output Directory to{" "}
          <code className="font-mono text-[10px]">dist</code>. Cutover details
          in docs/VERCEL-BUILD.md.
        </p>
      </div>

      <div className="crm-surface space-y-3 p-5">
        <p className="crm-label">Data plane</p>
        {isLoading && (
          <p className="text-xs text-fg-muted">Checking wire status…</p>
        )}
        {wire && (
          <>
            <div
              className={cn(
                "rounded-lg border px-3 py-2.5",
                wire.connected
                  ? "border-product-mint/40 bg-product-mint/10"
                  : "border-border-soft bg-mist/60",
              )}
            >
              <p className="text-sm font-semibold text-ink">
                {wire.source === "live"
                  ? "LIVE — Supabase REST"
                  : "MOCK — seed"}
              </p>
              <p className="mt-1 text-[12px] text-fg-muted">{wire.message}</p>
            </div>

            {wire.env && (
              <div className="rounded-lg border border-border-soft bg-mist/40 px-3 py-2.5 text-[12px]">
                <p className="mb-2 font-semibold text-ink">
                  Env presence (names only · no secrets)
                </p>
                <ul className="space-y-1 font-mono text-[11px]">
                  <li>
                    host: <strong>{wire.env.host}</strong>
                  </li>
                  <li>project: {wire.env.projectHint}</li>
                  <li
                    className={
                      wire.env.hasNextPublicSupabaseUrl
                        ? "text-product-mint"
                        : "text-warn"
                    }
                  >
                    NEXT_PUBLIC_SUPABASE_URL{" "}
                    {wire.env.hasNextPublicSupabaseUrl ? "✓" : "missing"}
                  </li>
                  <li
                    className={
                      wire.env.hasServiceRoleKey
                        ? "text-product-mint"
                        : "text-warn"
                    }
                  >
                    SUPABASE_SERVICE_ROLE_KEY{" "}
                    {wire.env.hasServiceRoleKey ? "✓" : "missing"}
                  </li>
                  <li
                    className={
                      wire.env.hasAnonKey
                        ? "text-product-mint"
                        : "text-fg-muted"
                    }
                  >
                    NEXT_PUBLIC_SUPABASE_ANON_KEY{" "}
                    {wire.env.hasAnonKey ? "✓" : "missing"}
                  </li>
                  <li>auth key used: {wire.env.keyKind}</li>
                </ul>
              </div>
            )}

            <div>
              <p className="mb-1 text-[11px] font-semibold text-fg-subtle">
                Wired tables
              </p>
              <ul className="flex flex-wrap gap-1">
                {wire.tables.map((t) => (
                  <li
                    key={t}
                    className="rounded-md border border-border-soft bg-card px-2 py-0.5 font-mono text-[11px]"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold text-fg-subtle">
                Locked (never reimplement)
              </p>
              <ul className="space-y-1 text-[12px] text-fg-muted">
                {wire.locked.map((l) => (
                  <li key={l}>· {l}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border-soft bg-deep-ink/5 px-3 py-2 font-mono text-[10px] text-fg-muted">
              <p className="mb-1 font-sans text-[11px] font-semibold text-ink">
                Env (Production + Preview on crm-rivvetai)
              </p>
              <p>NEXT_PUBLIC_SUPABASE_URL=…</p>
              <p>SUPABASE_SERVICE_ROLE_KEY=…</p>
              <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=…</p>
              <p>CRM_BASE_URL=https://crm.rivvetai.com</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold text-fg-subtle">
                Recommended indexes
              </p>
              <ul className="space-y-0.5 font-mono text-[10px] text-fg-muted">
                {SEQUENCE_SQL.indexes.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      <div className="crm-surface space-y-4 p-5">
        <div>
          <p className="crm-label mb-2">Brand</p>
          <div className="rounded-xl border border-border-soft bg-mist/60 px-4 py-4">
            <RivvetBrand variant="light" />
          </div>
        </div>
        <div className="rounded-xl border border-border-soft bg-deep-ink px-4 py-4">
          <RivvetBrand variant="dark" />
        </div>
      </div>
    </div>
  );
}
