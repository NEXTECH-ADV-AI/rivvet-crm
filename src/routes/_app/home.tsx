import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Building2, Target } from "lucide-react";
import { PageHeader } from "@/components/crm/page-header";
import { PriorityBadge } from "@/components/crm/priority-badge";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW } from "@/lib/crm/seed";
import { useLeadBook, useLeadsList } from "@/lib/crm/wire";
import { queueAccounts, queueOpps } from "@/lib/crm/filters";
import {
  accountPriority,
  formatMoney,
  formatRelative,
  oppPriority,
  STAGE_LABEL,
} from "@/lib/crm/priority";
import type { Priority } from "@/lib/crm/types";

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});

function HomePage() {
  const opportunities = useCrmStore((s) => s.opportunities);
  const accounts = useCrmStore((s) => s.accounts);

  const oppQ = queueOpps(opportunities);
  const acctQ = queueAccounts(accounts);
  const bookQ = useLeadBook();
  const callQ = useLeadsList({ view: "call_queue", limit: 1, offset: 0 });
  const book = bookQ.data?.book;
  const fmt = (n: number | undefined) => (n == null ? "…" : n.toLocaleString());

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="What needs you"
        description="Who to call, then how outreach is doing."
      />

      <Link
        to="/leads"
        className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-product-mint/30 bg-product-mint/10 p-4 shadow-soft transition hover:bg-product-mint/15"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-product-mint">Call queue</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
            {callQ.data ? callQ.data.total.toLocaleString() : "…"}
            <span className="ml-2 text-sm font-normal text-fg-muted">people who opened an email and have a phone</span>
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-ink">Start calling →</span>
      </Link>

      <div className="mb-5 rounded-xl border border-border-soft bg-card p-3 shadow-soft sm:p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Outreach</h2>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-fg-muted hover:underline"
          >
            <BarChart3 className="size-3" /> Analytics
          </Link>
        </div>
        {!book ? (
          <p className="text-xs text-fg-muted">{bookQ.isError ? "Couldn't load the totals. Refresh to try again." : "Loading totals…"}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Leads" value={fmt(book.total)} />
            <Kpi label="In a campaign" value={fmt(book.inInstantly)} />
            <Kpi label="Opened" value={fmt(book.opened)} accent />
            <Kpi label="Replied" value={fmt(book.replied)} hint="out-of-office not counted" />
            <Kpi label="Demos booked" value={fmt(book.demosBooked)} hint="all sources" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QueuePanel title="Opportunities needing a next step" icon={Target} to="/opportunities">
          {oppQ.length === 0 ? (
            <p className="text-xs text-fg-muted">Every open opportunity has a next step.</p>
          ) : (
            oppQ.slice(0, 5).map((o) => {
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
            })
          )}
        </QueuePanel>

        <QueuePanel title="Accounts to check on" icon={Building2} to="/accounts">
          {acctQ.length === 0 ? (
            <p className="text-xs text-fg-muted">No account needs attention.</p>
          ) : (
            acctQ.slice(0, 5).map((a) => {
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
                    amount={a.arr ? `${formatMoney(a.arr)} a year` : null}
                  />
                </Link>
              );
            })
          )}
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
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="crm-label">{label}</p>
      <p
        className={`mt-0.5 font-mono text-lg font-semibold tabular ${
          accent ? "text-product-mint" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-fg-subtle">{hint}</p>}
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
  icon: typeof Target;
  to: "/accounts" | "/opportunities";
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
