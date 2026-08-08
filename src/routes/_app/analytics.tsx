import { useMemo } from "react";
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
import { buildGtmAnalytics, formatMoney } from "@/lib/crm/analytics";
import { formatDate } from "@/lib/crm/priority";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsPage,
});

const CHART_INK = "#072336";
const CHART_MINT = "#00B089";
const CHART_CYAN = "#00C8FF";
const CHART_MUTED = "#7a929c";
const PIE = ["#00B089", "#00C8FF", "#072336", "#c9851a", "#4a6470"];

function AnalyticsPage() {
  const opportunities = useCrmStore((s) => s.opportunities);
  const leads = useCrmStore((s) => s.leads);
  const accounts = useCrmStore((s) => s.accounts);
  const activities = useCrmStore((s) => s.activities);

  const data = useMemo(
    () => buildGtmAnalytics(opportunities, leads, accounts, activities),
    [opportunities, leads, accounts, activities],
  );
  const { kpis } = data;

  const campaignBars = Object.entries(data.campaignLoads ?? {}).map(
    ([name, count]) => ({ name, count: count ?? 0 }),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="GTM"
        title="Analytics"
        description="Sequence funnel first. Pipeline and close velocity second."
        action={
          <Link
            to="/leads"
            className="rounded-md border border-border-soft bg-card px-3 py-2 text-xs font-semibold shadow-soft hover:bg-mist"
          >
            Sequence-ready queue
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Book sequence-ready"
          value={String(kpis.bookSequenceReady)}
          sub={`${kpis.bookValidEmail} valid email`}
          accent
        />
        <Kpi
          label="Book in Instantly"
          value={String(kpis.bookInInstantly)}
          sub="mostly HVAC Nat'l"
        />
        <Kpi
          label="HVAC share"
          value={`${kpis.hvacShare}%`}
          warn={kpis.hvacShare > 40}
        />
        <Kpi label="Pipeline" value={formatMoney(kpis.pipeline)} />
        <Kpi label="Weighted" value={formatMoney(kpis.weighted)} />
        <Kpi
          label="Close ≤30d"
          value={formatMoney(kpis.closing30Amt)}
          sub={`${kpis.closing30Count} deals`}
        />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <MiniStat label="Ready, not loaded" value={kpis.readyNotLoaded} />
        <MiniStat label="Needs enrich" value={kpis.needsEnrich} />
        <MiniStat label="Needs verify" value={kpis.needsVerify} />
        <MiniStat label="Accounts at risk" value={kpis.atRisk} warn />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Instantly loads by campaign"
          subtitle="Idle campaigns show 0"
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={campaignBars}
                margin={{ top: 4, right: 8, left: 0, bottom: 40 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#d5e0dc"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: CHART_MUTED, fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: CHART_MUTED, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {campaignBars.map((e, i) => (
                    <Cell
                      key={e.name}
                      fill={e.count === 0 ? "#c9851a" : CHART_MINT}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Pipeline by stage" subtitle="Open amount">
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

        <Panel title="Velocity" subtitle="Created / won / lost">
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

        <Panel title="Lead source mix" subtitle="By count">
          <div className="flex h-52 items-center gap-4">
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
          title="Top open deals"
          subtitle="By amount"
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
                    <p className="truncate text-sm font-medium text-ink">
                      {d.name}
                    </p>
                    <p className="text-[11px] text-fg-subtle">
                      {d.stage}
                      {d.closeDate ? ` · ${formatDate(d.closeDate)}` : ""}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular">
                    {formatMoney(d.amount)}
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
  value: number;
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
        {value}
      </p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`crm-surface p-4 ${className ?? ""}`}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-fg-subtle">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}
