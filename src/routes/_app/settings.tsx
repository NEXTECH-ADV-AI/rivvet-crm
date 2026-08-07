import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/page-header";
import { RivvetBrand } from "@/components/crm/logo";
import { useWireStatus } from "@/lib/crm/wire";
import { useCrmStore } from "@/lib/crm/store";
import { SEQUENCE_SQL } from "@/lib/crm/sequence-queries";
import { cn } from "@/components/ui/cn";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const BUILD_ROWS: { label: string; value: string }[] = [
  { label: "Project", value: "rivvet-crm (sibling)" },
  { label: "URL", value: "rivvet-crm-rivvetai.vercel.app" },
  { label: "Framework", value: "Vite + TanStack Start" },
  { label: "Build", value: "git bootstrap → npm run build" },
  { label: "Output", value: "Nitro .vercel/output" },
  { label: "Domain (later)", value: "crm.rivvetai.com" },
];

const E2E_CHECKS: { area: string; status: string; note: string }[] = [
  {
    area: "Home / Today queue",
    status: "ready",
    note: "Hydrates leads · accounts · opps",
  },
  {
    area: "Leads + Sequences",
    status: "ready",
    note: "Filters, book strip, Load GO sim",
  },
  {
    area: "Accounts",
    status: "ready",
    note: "Supabase accounts + contacts",
  },
  {
    area: "Opportunities kanban",
    status: "ready",
    note: "crm_opportunities + stage patch (LIVE)",
  },
  {
    area: "Deal builder",
    status: "ready",
    note: "Service + commerce catalog (local price)",
  },
  {
    area: "Contract send / PandaDoc / Stripe",
    status: "locked",
    note: "Sacred — use production path",
  },
  {
    area: "Instantly Load GO",
    status: "locked",
    note: "n8n only — sim in MOCK",
  },
  {
    area: "Analytics GTM",
    status: "ready",
    note: "Widgets from hydrated book",
  },
];

function SettingsPage() {
  const { data: wire, isLoading } = useWireStatus();
  const dataSource = useCrmStore((s) => s.dataSource);
  const hydrateMessage = useCrmStore((s) => s.hydrateMessage);
  const counts = {
    leads: useCrmStore((s) => s.leads.length),
    accounts: useCrmStore((s) => s.accounts.length),
    opps: useCrmStore((s) => s.opportunities.length),
    activities: useCrmStore((s) => s.activities.length),
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="E2E test surface on rivvet-crm — domain cutover when green. Sacred send stays locked."
      />

      <div className="crm-surface space-y-3 p-5">
        <p className="crm-label">E2E readiness (pre-DNS)</p>
        <p className="text-[12px] text-fg-muted">
          Same pattern as ops/command: ship sibling → exercise full product →
          flip domain when ready. Book mode:{" "}
          <strong className="text-ink">{dataSource}</strong>
          {hydrateMessage ? ` · ${hydrateMessage}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Leads", counts.leads],
              ["Accounts", counts.accounts],
              ["Opps", counts.opps],
              ["Activities", counts.activities],
            ] as const
          ).map(([k, v]) => (
            <div
              key={k}
              className="rounded-lg border border-border-soft bg-mist/50 px-3 py-2"
            >
              <p className="crm-label">{k}</p>
              <p className="font-mono text-lg font-semibold tabular">{v}</p>
            </div>
          ))}
        </div>
        <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
          {E2E_CHECKS.map((c) => (
            <li
              key={c.area}
              className="flex items-start justify-between gap-3 px-3 py-2.5 text-[12px]"
            >
              <div>
                <p className="font-medium text-ink">{c.area}</p>
                <p className="text-[11px] text-fg-muted">{c.note}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase",
                  c.status === "ready"
                    ? "border-product-mint/40 bg-product-mint/10 text-product-mint"
                    : "border-warn/40 bg-warn/10 text-warn",
                )}
              >
                {c.status}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="crm-surface space-y-3 p-5">
        <p className="crm-label">Vercel (rivvet-crm)</p>
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
                  : "border-warn/40 bg-warn/10",
              )}
            >
              <p className="text-sm font-semibold text-ink">
                {wire.source === "live"
                  ? "LIVE — Supabase REST (service_role)"
                  : "MOCK — seed pipeline (not production opps)"}
              </p>
              <p className="mt-1 text-[12px] text-fg-muted">{wire.message}</p>
              {wire.blockReason ? (
                <p className="mt-1 font-mono text-[10px] text-warn">
                  block: {wire.blockReason}
                </p>
              ) : null}
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
                  <li>supabase: {wire.env.supabaseHost}</li>
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
                    {wire.env.hasServiceRoleKey ? "✓" : "missing — required"}
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

            <div className="rounded-lg border border-border-soft bg-deep-ink/5 px-3 py-2.5 text-[12px] text-fg-muted">
              <p className="mb-1 font-sans text-[11px] font-semibold text-ink">
                Connect LIVE (ops/command pattern — 2 minutes)
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-[11px]">
                <li>
                  Vercel → <strong className="text-ink">crm-rivvetai</strong> →
                  Settings → Environment Variables
                </li>
                <li>
                  Copy <code className="text-ink">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
                  (and URL/anon if not already defaulted)
                </li>
                <li>
                  Paste onto <strong className="text-ink">rivvet-crm</strong>{" "}
                  (Production + Preview) — same as{" "}
                  <code className="text-ink">LINEAR_API_KEY</code> for
                  ops/command
                </li>
                <li>
                  Do <strong className="text-ink">not</strong> set{" "}
                  <code className="text-ink">CRM_DATA_SOURCE=mock</code>
                </li>
                <li>Redeploy Production → chip flips to LIVE</li>
              </ol>
              <p className="mt-2 font-mono text-[10px]">
                Or paste SUPABASE_SERVICE_ROLE_KEY in chat once — we inject on
                deploy (never commit).
              </p>
            </div>

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
