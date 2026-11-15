import { useState } from "react";
import { FounderMorningBrief } from "@/components/crm/founder-morning-brief";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Building2, Target } from "lucide-react";
import { PageHeader } from "@/components/crm/page-header";
import { PriorityBadge } from "@/components/crm/priority-badge";
import { useCrmStore } from "@/lib/crm/store";
import { buildDailyWork } from "@/lib/crm/daily-work";
import { useLeadBook, useLeadsList } from "@/lib/crm/wire";
import { queueAccounts, queueOpps } from "@/lib/crm/filters";
import { pipelineState } from "@/lib/crm/analytics";
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
  const { user } = Route.useRouteContext();
  const [showAllPriorities, setShowAllPriorities] = useState(false);
  const now = Date.now();
  const activities = useCrmStore((s) => s.activities);
  const hydrateMessage = useCrmStore((s) => s.hydrateMessage);
  const opportunities = useCrmStore((s) => s.opportunities);
  const accounts = useCrmStore((s) => s.accounts);
  const hydratedAt = useCrmStore((s) => s.hydratedAt);
  const unavailable = useCrmStore((s) => s.opportunitiesUnavailable);
  const pipeline = pipelineState({ opportunities, hydratedAt, unavailable });

  const dailyWork = buildDailyWork(unavailable ? [] : opportunities, accounts, activities, now);
  const oppQ = queueOpps(opportunities);
  const acctQ = queueAccounts(accounts);
  const bookQ = useLeadBook();
  const callQ = useLeadsList({ view: "call_queue", limit: 1, offset: 0 });
  const book = bookQ.data?.book;
  const fmt = (n: number | undefined) => (n == null ? "…" : n.toLocaleString());

  return (
    <div className="mx-auto max-w-[1320px]">
      <PageHeader
        title="What needs you"
        description="Your next decisions, customer follow-ups and sales work."
      />

      {user.email === "brayden@rivvetai.com" && <FounderMorningBrief />}

      <section className="mb-5 crm-surface overflow-hidden" aria-label="Today priorities">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft bg-card px-5 py-3 text-ink">
          <h2 className="text-[15px] font-semibold">Start here <span className="font-normal text-fg-muted">· Today</span></h2>
          <span className="text-[13px] text-fg-muted">{hydratedAt ? `${dailyWork.filter((item) => item.state === "overdue").length} overdue · ${dailyWork.filter((item) => item.state === "today").length} due today` : "Loading priority counts..."}</span>
        </div>
        {!hydratedAt ? <p className="p-4 text-sm text-fg-muted">Loading your priorities...</p> : <>
          {hydrateMessage?.includes("unavailable") && <p role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Some source data is unavailable. This priority list may be incomplete.</p>}
          {dailyWork.length ? <ol id="daily-priority-list" className="divide-y divide-border-soft">{(showAllPriorities ? dailyWork : dailyWork.slice(0, 3)).map((item, index) => <li key={item.id}><a href={item.href} className="flex items-start gap-3 px-5 py-3 hover:bg-mist">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-mist font-mono text-xs text-fg-muted">{index + 1}</span>
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{item.title}</p><p className="mt-0.5 break-words text-xs text-fg-muted">{item.record} · {item.reason}</p></div>
            <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${item.state === "overdue" ? "bg-red-50 text-red-800" : item.state === "today" ? "bg-product-mint/10 text-product-mint" : "bg-mist text-fg-muted"}`}>{item.state === "unscheduled" ? "Plan next" : item.state === "upcoming" ? "Upcoming" : item.state === "today" ? "Today" : "Overdue"}</span>
          </a></li>)}</ol> : <p className="p-4 text-sm text-fg-muted">No follow-ups flagged in the loaded records.</p>}
          {dailyWork.length > 3 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft px-5 py-2">
            <span className="text-xs text-fg-muted">Showing {showAllPriorities ? dailyWork.length : 3} of {dailyWork.length} priorities</span>
            <button type="button" aria-expanded={showAllPriorities} aria-controls="daily-priority-list" onClick={() => setShowAllPriorities((show) => !show)} className="min-h-11 rounded-md px-3 py-2 text-xs font-semibold text-product-mint hover:bg-mist">
              {showAllPriorities ? "Show fewer" : `Show all ${dailyWork.length}`}
            </button>
          </div>}
          <div className="flex flex-wrap justify-between gap-2 border-t border-border-soft px-5 py-3 text-xs text-fg-muted"><span>{dailyWork.length} flagged across {opportunities.length} loaded opportunities (up to 200), {accounts.length} loaded accounts and recent tasks.</span><Link to="/activities" className="font-semibold text-product-mint">All activities →</Link></div>
        </>}
      </section>

      <Link
        to="/leads"
        className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 transition hover:bg-card-soft"
      >
        <div>
          <p className="text-[15px] font-semibold text-ink">Call queue</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {callQ.data ? callQ.data.total.toLocaleString() : "…"}
            <span className="ml-2 text-sm font-normal text-fg-muted">people who opened an email and have a phone</span>
          </p>
        </div>
        <span className="shrink-0 text-[15px] font-semibold text-ink">Start calling →</span>
      </Link>

      <div className="mb-5 rounded-xl border border-border bg-card px-5 py-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-ink">Outreach <span className="font-normal text-fg-subtle">· all time, full lead book</span></h2>
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <QueuePanel title="Opportunities needing a next step" icon={Target} to="/opportunities">
          {pipeline === "loading" ? (
            <p className="text-xs text-fg-muted">Loading opportunities…</p>
          ) : pipeline === "unavailable" ? (
            <p role="alert" className="text-xs text-red-800">
              Opportunities are unavailable right now. Refresh to try again.
            </p>
          ) : pipeline === "empty" ? (
            <p className="text-xs text-fg-muted">No opportunities yet.</p>
          ) : oppQ.length === 0 ? (
            <p className="text-xs text-fg-muted">Every open opportunity has a next step.</p>
          ) : (
            oppQ.slice(0, 5).map((o) => {
              const p = oppPriority(o, now);
              return (
                <Link
                  key={o.id}
                  to="/opportunities/$oppId"
                  params={{ oppId: o.id }}
                  className="group flex items-start gap-3 border-b border-border-soft py-3 transition last:border-b-0 hover:bg-card-soft"
                >
                  <QueueBody
                    title={o.name}
                    meta={`${STAGE_LABEL[o.stage]} · ${formatRelative(o.lastTouch, now)}`}
                    next={o.nextAction ?? "Set next step"}
                    priority={p.priority}
                    amount={o.amountKnown === false ? "Not priced" : formatMoney(o.amount)}
                  />
                </Link>
              );
            })
          )}
        </QueuePanel>

        <QueuePanel title="Accounts to check on" icon={Building2} to="/accounts">
          {!hydratedAt ? (
            <p className="text-xs text-fg-muted">Loading accounts...</p>
          ) : acctQ.length === 0 && hydrateMessage?.includes("customer accounts unavailable") ? (
            <p role="alert" className="text-xs text-red-800">Customer accounts are unavailable right now. Refresh to try again.</p>
          ) : acctQ.length === 0 ? (
            <p className="text-xs text-fg-muted">No account is flagged at risk in the loaded account sample.</p>
          ) : (
            acctQ.slice(0, 5).map((a) => {
              const p = accountPriority(a, now);
              return (
                <Link
                  key={a.id}
                  to="/accounts/$accountId"
                  params={{ accountId: a.id }}
                  className="group flex items-start gap-3 border-b border-border-soft py-3 transition last:border-b-0 hover:bg-card-soft"
                >
                  <QueueBody
                    title={a.name}
                    meta={`${p.reasons[0]} · ${formatRelative(a.lastTouch, now)}`}
                    next={a.nextAction ?? "Set next step"}
                    priority={p.priority}
                    amount={a.arr ? `${formatMoney(a.arr)} base ARR` : null}
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
      <p className="text-[13px] text-fg-muted">{label}</p>
      <p
        className={`mt-1 text-[26px] font-semibold leading-none tabular ${
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
    <section className={`crm-surface overflow-hidden ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-5 py-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-fg-muted" />
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        </div>
        <Link
          to={to}
          className="inline-flex items-center gap-1 text-xs font-medium text-product-mint hover:underline"
        >
          Open <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="px-5 py-4">{children}</div>
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="break-words text-sm font-medium text-ink">{title}</p>
          {amount && (
            <span className="shrink-0 font-mono text-xs font-semibold tabular text-ink">
              {amount}
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-fg-subtle">{meta}</p>
        <p className="mt-1 break-words text-xs font-medium text-fg-muted">
          Next: <span className="text-ink">{next}</span>
        </p>
      </div>
    </>
  );
}
