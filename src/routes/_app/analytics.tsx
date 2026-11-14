import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/crm/page-header";
import { PriorityBadge } from "@/components/crm/priority-badge";
import { useCrmStore } from "@/lib/crm/store";
import { useLeadBook } from "@/lib/crm/wire";
import { buildGtmAnalytics, formatMoney, pipelineKpiDisplay, pipelineState } from "@/lib/crm/analytics";
import { formatDate, STAGE_LABEL, plain } from "@/lib/crm/priority";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsPage,
});

const CHART_INK = "#072336";
const CHART_MINT = "#00B089";
const CHART_CYAN = "#00C8FF";
const CHART_MUTED = "#7a929c";
const PIE = ["#00B089", "#00C8FF", "#072336", "#c9851a", "#4a6470"];

function AnalyticsPage() {
  const [period, setPeriod] = useState<"30d" | "all">("30d");
  const coverage = useCrmStore((s) => s.coverage);
  const opportunities = useCrmStore((s) => s.opportunities);
  const leads = useCrmStore((s) => s.leads);
  const accounts = useCrmStore((s) => s.accounts);
  const activities = useCrmStore((s) => s.activities);
  const hydratedAt = useCrmStore((s) => s.hydratedAt);
  const unavailable = useCrmStore((s) => s.opportunitiesUnavailable);
  const pipeline = pipelineState({ opportunities, hydratedAt, unavailable });
  const notice =
    pipeline === "loading"
      ? "Loading opportunities…"
      : pipeline === "unavailable"
        ? "Opportunities are unavailable right now. Refresh to try again."
        : pipeline === "empty"
          ? "No opportunities yet."
          : null;
  const book = useLeadBook().data?.book ?? null;

  const data = useMemo(
    () => buildGtmAnalytics(opportunities, leads, accounts, activities, book, { period }),
    [opportunities, leads, accounts, activities, book, period],
  );
  const n = (v: number | null) => (v == null ? "…" : v.toLocaleString());
  const { kpis } = data;
  const money = pipelineKpiDisplay(pipeline, kpis);
  const pipelineUnavailable = pipeline === "loading" || pipeline === "unavailable";
  const activityUnavailable = useCrmStore((s) => s.hydrateMessage)?.includes("activities unavailable");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Analytics"
        description="Leads, outreach and opportunities."
        action={
          <Link
            to="/leads"
            className="rounded-md border border-border-soft bg-card px-3 py-2 text-xs font-semibold shadow-soft hover:bg-mist"
          >
            Email readiness
          </Link>
        }
      />

      <section className="mb-5 crm-surface p-4" aria-label="Reporting period">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold">Sales activity</h2><p className="text-xs text-fg-muted">Choose the reporting window. Pipeline below is the current open book.</p></div>
          <div className="flex gap-1 rounded-lg bg-mist p-1" aria-label="Date range">
            {(["30d", "all"] as const).map((value) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`rounded-md px-3 py-2 text-xs font-semibold ${period === value ? "bg-ink text-white" : "text-fg-muted"}`}>{value === "30d" ? "Past 30 days" : "All time"}</button>)}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Opportunities created" value={pipelineUnavailable ? null : data.period.created} />
          <MiniStat label="Won opportunities, all time" value={pipelineUnavailable ? null : data.period.won} />
          <MiniStat label="Lost opportunities, all time" value={pipelineUnavailable ? null : data.period.lost} />
          <MiniStat label="Loaded activity records" value={!hydratedAt || activityUnavailable ? null : data.period.activities} />
        </div>
        <p className="mt-3 text-xs text-fg-subtle">Coverage: {opportunities.length} loaded opportunities (read limit 200), {leads.length} loaded leads, {accounts.length} of {coverage?.accounts ?? "unknown"} accounts, and {activities.length} recent activities. The date filter applies to created opportunities, dated activities and lead source mix. Won/lost totals use all time because a close timestamp is not available.</p>
      </section>
      <p className="mb-2 text-xs font-semibold text-fg-muted">Current book totals, all time</p>
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Ready for email"
          value={n(kpis.bookSequenceReady)}
          sub={`${n(kpis.bookValidEmail)} valid email`}
          accent
        />
        <Kpi
          label="In a campaign"
          value={n(kpis.bookInInstantly)}
          sub={`of ${n(kpis.bookTotal)} leads`}
        />
        <Kpi
          label="HVAC share"
          value={kpis.hvacShare == null ? "…" : `${kpis.hvacShare}%`}
        />
        <Kpi label="Open pipeline" value={money.pipeline} sub={`${kpis.openDeals} open, ${kpis.unpriced} not priced`} />
        <Kpi label="Weighted" value={money.weighted} sub="Known amounts only" />
        <Kpi
          label="Closing in 30 days"
          value={money.closing}
          sub={money.closingSub}
        />
      </div>

      <p className="mb-2 text-xs text-fg-subtle">Readiness below covers the {leads.length} loaded leads; account risk covers {accounts.length} loaded accounts.</p>
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <MiniStat label="Ready, not in a campaign" value={kpis.readyNotLoaded} />
        <MiniStat label="Missing details" value={kpis.needsEnrich} />
        <MiniStat label="Email not checked" value={kpis.needsVerify} />
        <MiniStat label="Accounts at risk" value={kpis.atRisk} warn />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        <Panel title="Pipeline by stage" subtitle={`Current open amounts only; ${kpis.unpriced} unpriced excluded. Closed-won is separate.`} notice={notice}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.byStage}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#d5e0dc"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: CHART_MUTED, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: CHART_MUTED, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                  width={40}
                />
                <Tooltip
                  formatter={(v: number) => formatMoney(v)}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="amount" fill={CHART_MINT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Opportunity cohorts" subtitle="Last six creation weeks, grouped by current outcome. These are not close dates." notice={notice}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weekly}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#d5e0dc"
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  tick={{ fill: CHART_MUTED, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: CHART_MUTED, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="created"
                  stroke={CHART_CYAN}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="won"
                  stroke={CHART_MINT}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="lost"
                  stroke={CHART_INK}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Lead source mix" subtitle={`${data.period.leads} loaded leads created ${period === "30d" ? "in the past 30 days" : "all time"}; this is a sample, not the full lead book.`}>
          <div className="flex min-h-52 flex-wrap items-center gap-4">
            <div className="h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.sourceMix}
                    dataKey="value"
                    nameKey="source"
                    innerRadius={36}
                    outerRadius={64}
                    paddingAngle={2}
                  >
                    {data.sourceMix.map((_, i) => (
                      <Cell key={i} fill={PIE[i % PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {data.sourceMix.map((s, i) => (
                <li
                  key={s.source}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2 text-fg-muted">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: PIE[i % PIE.length] }}
                    />
                    {s.source}
                  </span>
                  <span className="font-mono font-semibold tabular text-ink">
                    {s.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel
          title="Top open opportunities"
          subtitle="By amount"
          notice={notice}
          className="lg:col-span-2"
        >
          <ul className="divide-y divide-border-soft">
            {data.topDeals.map((d) => (
              <li key={d.id}>
                <Link
                  to="/opportunities/$oppId"
                  params={{ oppId: d.id }}
                  className="flex items-center gap-3 py-2.5 hover:bg-mist/50"
                >
                  <PriorityBadge priority={d.priority} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-ink">
                      {d.name}
                    </p>
                    <p className="text-[11px] text-fg-subtle">
                      {STAGE_LABEL[d.stage] ?? plain(d.stage)}
                      {d.closeDate ? ` · ${formatDate(d.closeDate)}` : ""}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular">
                    {d.amountKnown === false ? "Not priced" : formatMoney(d.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "#fff",
  border: "1px solid #d5e0dc",
  borderRadius: 8,
  fontSize: 12,
};

function Kpi({
  label,
  value,
  sub,
  accent,
  mono,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  mono?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="crm-surface px-3 py-3">
      <p className="crm-label">{label}</p>
      <p
        className={`mt-1 font-mono text-xl font-semibold tabular ${
          warn
            ? "text-warn"
            : accent
              ? "text-product-mint"
              : mono
                ? "text-ink"
                : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-fg-subtle">{sub}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number | null;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border-soft bg-card-soft px-3 py-2.5">
      <p className="text-[11px] text-fg-muted">{label}</p>
      <p
        className={`font-mono text-lg font-semibold tabular ${
          warn ? "text-warn" : "text-ink"
        }`}
      >
        {value == null ? "Unavailable" : value}
      </p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className,
  notice,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  /** When set, shown in place of the panel body. */
  notice?: string | null;
}) {
  return (
    <section className={`crm-surface p-4 ${className ?? ""}`}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-fg-subtle">{subtitle}</p>
        )}
      </div>
      {notice ? (
        <p className="py-6 text-center text-xs text-fg-muted">{notice}</p>
      ) : (
        children
      )}
    </section>
  );
}
