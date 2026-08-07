import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Mail,
  Target,
  Users,
  BarChart3,
  Layers,
} from "lucide-react";
import { PageHeader } from "@/components/crm/page-header";
import { PriorityBadge } from "@/components/crm/priority-badge";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW, leadBookSnapshot } from "@/lib/crm/seed";
import { queueAccounts, queueLeads, queueOpps } from "@/lib/crm/filters";
import {
  accountPriority,
  formatMoney,
  formatPct,
  formatRelative,
  leadPriority,
  oppPriority,
  STAGE_LABEL,
} from "@/lib/crm/priority";
import {
  SEQUENCE_VERTICALS,
  VERTICAL_LABEL,
  needsEmailVerify,
  needsEnrich,
  sequenceStats,
} from "@/lib/crm/lead-model";
import { isLoadEligible } from "@/lib/crm/sequence-queries";
import type { Priority } from "@/lib/crm/types";
import { buildGtmAnalytics } from "@/lib/crm/analytics";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});

function HomePage() {
  const leads = useCrmStore((s) => s.leads);
  const opportunities = useCrmStore((s) => s.opportunities);
  const accounts = useCrmStore((s) => s.accounts);
  const activities = useCrmStore((s) => s.activities);

  const leadQ = queueLeads(leads);
  const oppQ = queueOpps(opportunities);
  const acctQ = queueAccounts(accounts);
  const stats = useMemo(() => sequenceStats(leads), [leads]);
  const loadEligible = useMemo(
    () => leads.filter(isLoadEligible).length,
    [leads],
  );
  const book = leadBookSnapshot;

  const gtm = useMemo(
    () => buildGtmAnalytics(opportunities, leads, accounts, activities),
    [opportunities, leads, accounts, activities],
  );

  const enrichQ = leads.filter(needsEnrich).slice(0, 5);
  const verifyQ = leads.filter(needsEmailVerify).slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="GTM · sequence-first"
        title="What needs you"
        description="Load-eligible leads into multi-vertical Instantly. HVAC RCA before scale. Cold call deferred. Deal send locked."
        action={
          <Link
            to="/sequences"
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white shadow-soft hover:bg-ink/90"
          >
            <Mail className="size-3.5" />
            Sequences · Load GO
          </Link>
        }
      />

      <div className="mb-4 rounded-xl border border-border-soft bg-card p-3 shadow-soft sm:p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">
            Book → Instantly (full book mirror)
          </h2>
          <div className="flex gap-3">
            <Link
              to="/sequences"
              className="text-[11px] font-medium text-product-mint hover:underline"
            >
              Load GO board
            </Link>
            <Link
              to="/analytics"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-fg-muted hover:underline"
            >
              <BarChart3 className="size-3" /> Analytics
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Scrapes" value={book.total.toLocaleString()} hint="inventory" />
          <Kpi
            label="Valid email"
            value={book.validEmail.toLocaleString()}
            hint={formatPct((book.validEmail / book.total) * 100)}
          />
          <Kpi
            label="Sequence-ready"
            value={book.sequenceReady.toLocaleString()}
            hint="north star supply"
            accent
          />
          <Kpi
            label="In Instantly"
            value={book.inInstantly.toLocaleString()}
            hint="mostly HVAC Nat'l"
          />
          <Kpi
            label="HVAC of book"
            value={`${book.hvacSharePct}%`}
            hint="rebalance when ready"
            warn={book.hvacSharePct > 40}
          />
          <Kpi
            label="Idle camps"
            value={String(
              Object.values(book.byCampaignLoads).filter((n) => !n).length,
            )}
            hint="of 6 verticals"
            warn
          />
        </div>
        <p className="mt-2 text-[11px] text-fg-muted">{book.notes}</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Load-eligible" value={loadEligible} tone="danger" />
        <Stat label="Needs enrich" value={stats.needsEnrich} tone="warn" />
        <Stat label="Needs verify" value={stats.needsVerify} tone="warn" />
        <Stat label="Opps needing action" value={oppQ.length} tone="mint" />
      </div>

      <div className="mb-5 crm-surface p-3">
        <div className="mb-2 flex items-center gap-2">
          <Layers className="size-4 text-fg-muted" />
          <h2 className="text-sm font-semibold text-ink">
            Sample load-eligible by vertical
          </h2>
          <span className="text-[11px] text-fg-subtle">
            Non-HVAC first · HVAC = RCA hold
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SEQUENCE_VERTICALS.map((v) => {
            const n = stats.byVerticalReady[v] ?? 0;
            return (
              <Link
                key={v}
                to="/sequences"
                className="rounded-md border border-border-soft bg-mist/50 px-2.5 py-1.5 text-[11px] hover:border-product-mint/40"
              >
                <span className="font-medium text-ink">
                  {VERTICAL_LABEL[v]}
                </span>
                <span className="ml-1.5 font-mono font-semibold tabular text-product-mint">
                  {n}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <QueuePanel
          title="Load-eligible → Instantly"
          icon={Mail}
          to="/leads"
        >
          {leadQ.length === 0 ? (
            <p className="text-xs text-fg-muted">
              No load-eligible in sample. Open Needs enrich / Needs verify or
              Sequences.
            </p>
          ) : (
            leadQ.slice(0, 6).map((l) => {
              const p = leadPriority(l, DEMO_NOW);
              return (
                <Link
                  key={l.id}
                  to="/leads/$leadId"
                  params={{ leadId: l.id }}
                  className="group flex items-start gap-3 rounded-lg border border-border-soft bg-card-soft/60 px-3 py-2.5 transition hover:border-product-mint/40 hover:bg-mist"
                >
                  <QueueBody
                    title={l.name}
                    meta={`${VERTICAL_LABEL[l.vertical]} · ${l.state ?? "—"} · valid email`}
                    next={
                      l.nextAction ?? `Load to ${l.vertical} campaign`
                    }
                    priority={p.priority}
                    amount={l.amountHint ? formatMoney(l.amountHint) : null}
                  />
                </Link>
              );
            })
          )}
        </QueuePanel>

        <QueuePanel
          title="Opportunities needing action"
          icon={Target}
          to="/opportunities"
        >
          {oppQ.slice(0, 5).map((o) => {
            const p = oppPriority(o, DEMO_NOW);
            return (
              <Link
                key={o.id}
                to="/opportunities/$oppId"
                params={{ oppId: o.id }}
                className="group flex items-start gap-3 rounded-lg border border-border-soft bg-card-soft/60 px-3 py-2.5 transition hover:border-product-mint/40 hover:bg-mist"
              >
                <QueueBody
                  title={o.name}
                  meta={`${STAGE_LABEL[o.stage]} · ${formatRelative(o.lastTouch, DEMO_NOW)}`}
                  next={o.nextAction ?? "Set next step"}
                  priority={p.priority}
                  amount={formatMoney(o.amount)}
                />
              </Link>
            );
          })}
        </QueuePanel>

        <QueuePanel title="Enrich backlog" icon={Users} to="/leads">
          {enrichQ.map((l) => (
            <Link
              key={l.id}
              to="/leads/$leadId"
              params={{ leadId: l.id }}
              className="group flex items-start gap-3 rounded-lg border border-border-soft bg-card-soft/60 px-3 py-2.5 transition hover:border-product-mint/40 hover:bg-mist"
            >
              <QueueBody
                title={l.company}
                meta={`${VERTICAL_LABEL[l.vertical]} · ${l.state ?? "—"} · ${l.websiteUrl ? "has site" : "no site"}`}
                next="Run S2 enrich"
                priority={leadPriority(l, DEMO_NOW).priority}
                amount={null}
              />
            </Link>
          ))}
        </QueuePanel>

        <QueuePanel title="Email verify queue" icon={Mail} to="/leads">
          {verifyQ.map((l) => (
            <Link
              key={l.id}
              to="/leads/$leadId"
              params={{ leadId: l.id }}
              className="group flex items-start gap-3 rounded-lg border border-border-soft bg-card-soft/60 px-3 py-2.5 transition hover:border-product-mint/40 hover:bg-mist"
            >
              <QueueBody
                title={l.company}
                meta={`${l.email || "no email"} · ${l.emailVerificationStatus}`}
                next="NeverBounce / S4"
                priority={leadPriority(l, DEMO_NOW).priority}
                amount={null}
              />
            </Link>
          ))}
        </QueuePanel>

        <QueuePanel
          title="Accounts at risk"
          icon={Building2}
          to="/accounts"
          className="lg:col-span-2"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {acctQ.slice(0, 4).map((a) => {
              const p = accountPriority(a, DEMO_NOW);
              return (
                <Link
                  key={a.id}
                  to="/accounts/$accountId"
                  params={{ accountId: a.id }}
                  className="group flex items-start gap-3 rounded-lg border border-border-soft bg-card-soft/60 px-3 py-2.5 transition hover:border-product-mint/40 hover:bg-mist"
                >
                  <QueueBody
                    title={a.name}
                    meta={`${a.health === "risk" || a.status === "at_risk" ? "At risk" : "High value"} · ${formatRelative(a.lastTouch, DEMO_NOW)}`}
                    next={a.nextAction ?? "Set next step"}
                    priority={p.priority}
                    amount={a.arr ? formatMoney(a.arr) + " ARR" : null}
                  />
                </Link>
              );
            })}
          </div>
        </QueuePanel>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="crm-label">{label}</p>
      <p
        className={`mt-0.5 font-mono text-lg font-semibold tabular ${
          warn ? "text-warn" : accent ? "text-product-mint" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-fg-subtle">{hint}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warn" | "mint";
}) {
  const color =
    tone === "danger"
      ? "text-danger"
      : tone === "warn"
        ? "text-warn"
        : "text-product-mint";
  return (
    <div className="crm-surface px-3 py-3">
      <p className="crm-label">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular ${color}`}>
        {value}
      </p>
    </div>
  );
}

function QueuePanel({
  title,
  icon: Icon,
  to,
  children,
  className,
}: {
  title: string;
  icon: typeof Users;
  to: "/leads" | "/accounts" | "/opportunities" | "/sequences";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`crm-surface p-4 ${className ?? ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-fg-muted" />
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
        <Link
          to={to}
          className="inline-flex items-center gap-1 text-xs font-medium text-product-mint hover:underline"
        >
          Open <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function QueueBody({
  title,
  meta,
  next,
  priority,
  amount,
}: {
  title: string;
  meta: string;
  next: string;
  priority: Priority;
  amount: string | null;
}) {
  return (
    <>
      <PriorityBadge priority={priority} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-ink">{title}</p>
          {amount && (
            <span className="shrink-0 font-mono text-xs font-semibold tabular text-ink">
              {amount}
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-fg-subtle">{meta}</p>
        <p className="mt-1 truncate text-xs font-medium text-fg-muted">
          Next: <span className="text-ink">{next}</span>
        </p>
      </div>
    </>
  );
}
