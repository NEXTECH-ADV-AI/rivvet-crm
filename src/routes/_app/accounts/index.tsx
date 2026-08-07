import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/crm/page-header";
import { PriorityBadge } from "@/components/crm/priority-badge";
import { StatusChip } from "@/components/crm/status-chip";
import { EmptyState } from "@/components/crm/empty-state";
import { DEMO_NOW } from "@/lib/crm/seed";
import {
  accountPriority,
  formatMoney,
  formatRelative,
  OWNER_LABEL,
  STAGE_LABEL,
} from "@/lib/crm/priority";
import { VERTICAL_LABEL } from "@/lib/crm/lead-model";
import { useAccountsFunnel, useAccountsList, useWireStatus } from "@/lib/crm/wire";
import type { AccountLifecycle, Vertical } from "@/lib/crm/types";
import { cn } from "@/components/ui/cn";

export const Route = createFileRoute("/_app/accounts/")({
  component: AccountsPage,
});

const PAGE_SIZE = 50;

const LIFECYCLES: { value: AccountLifecycle | "all"; label: string }[] = [
  { value: "all", label: "All lifecycle" },
  { value: "prospect", label: "Prospect" },
  { value: "engaged", label: "Engaged" },
  { value: "opportunity", label: "Opportunity" },
  { value: "customer", label: "Customer" },
  { value: "churned", label: "Churned" },
];

function AccountsPage() {
  const [query, setQuery] = useState("");
  const [lifecycle, setLifecycle] = useState<AccountLifecycle | "all">("all");
  const [vertical, setVertical] = useState<string>("all");
  const [state, setState] = useState("all");
  const [sort, setSort] = useState<"recent" | "name" | "score">("recent");
  const [page, setPage] = useState(0);

  const wire = useWireStatus();
  const funnelQ = useAccountsFunnel();
  const listInput = useMemo(
    () => ({
      query,
      lifecycle: lifecycle === "all" ? undefined : lifecycle,
      vertical: vertical === "all" ? undefined : vertical,
      state: state === "all" ? undefined : state,
      sort,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [query, lifecycle, vertical, state, sort, page],
  );
  const listQ = useAccountsList(listInput);
  const rows = listQ.data?.accounts ?? [];
  const total = listQ.data?.total ?? 0;
  const source = listQ.data?.source ?? "mock";
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const funnel = funnelQ.data;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={`accounts · ${source}`}
        title="Accounts"
        description="Production accounts table — lifecycle, ownership, primary contact. Test accounts excluded on LIVE."
      />

      {funnel && (
        <section
          aria-label="Account totals"
          className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border-soft bg-border-soft sm:grid-cols-3 lg:grid-cols-6"
        >
          {(
            [
              ["All", funnel.total],
              ["Customers", funnel.customers],
              ["Opportunities", funnel.opportunities],
              ["Engaged", funnel.engaged],
              ["Prospects", funnel.prospects],
              ["Churned", funnel.churned],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-card px-3 py-2.5 sm:px-4 sm:py-3">
              <p className="crm-label">{label}</p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular text-ink">
                {Number(value).toLocaleString()}
              </p>
            </div>
          ))}
        </section>
      )}

      {listQ.data?.message && (
        <p className="mb-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-ink">
          {listQ.data.message}
        </p>
      )}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="min-w-[12rem] flex-1 text-[11px] text-fg-muted">
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Business name"
            className="field mt-1 w-full"
          />
        </label>
        <label className="text-[11px] text-fg-muted">
          Lifecycle
          <select
            value={lifecycle}
            onChange={(e) => {
              setLifecycle(e.target.value as AccountLifecycle | "all");
              setPage(0);
            }}
            className="field mt-1"
          >
            {LIFECYCLES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-fg-muted">
          Vertical
          <select
            value={vertical}
            onChange={(e) => {
              setVertical(e.target.value);
              setPage(0);
            }}
            className="field mt-1"
          >
            <option value="all">All</option>
            {(Object.keys(VERTICAL_LABEL) as Vertical[]).map((v) => (
              <option key={v} value={v}>
                {VERTICAL_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-fg-muted">
          State
          <input
            value={state === "all" ? "" : state}
            onChange={(e) => {
              const v = e.target.value.trim().toUpperCase();
              setState(v || "all");
              setPage(0);
            }}
            placeholder="UT"
            maxLength={2}
            className="field mt-1 w-16 font-mono"
          />
        </label>
        <label className="text-[11px] text-fg-muted">
          Sort
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as typeof sort);
              setPage(0);
            }}
            className="field mt-1"
          >
            <option value="recent">Recently updated</option>
            <option value="name">Name</option>
            <option value="score">ICP score</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-soft bg-card shadow-card">
        {listQ.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-fg-muted">
            Loading accounts…
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No accounts match"
            body={
              source === "mock"
                ? "Mock seed only — connect Supabase for production accounts."
                : "Adjust filters or clear search."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-border-soft bg-card-soft text-[10px] uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Priority</th>
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Lifecycle</th>
                  <th className="px-4 py-2.5 font-medium">Primary contact</th>
                  <th className="px-4 py-2.5 font-medium">Location</th>
                  <th className="px-4 py-2.5 font-medium">Owner</th>
                  <th className="px-4 py-2.5 font-medium">Updated</th>
                  <th className="px-4 py-2.5 font-medium text-right">ICP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const p = accountPriority(a, DEMO_NOW);
                  const life = a.lifecycleStage ?? a.status;
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-border-soft/80 last:border-0 hover:bg-mist/70"
                    >
                      <td className="px-4 py-3">
                        <PriorityBadge priority={p.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/accounts/$accountId"
                          params={{ accountId: a.id }}
                          className="font-medium text-ink hover:text-product-mint"
                        >
                          {a.name}
                        </Link>
                        <p className="text-[11px] capitalize text-fg-subtle">
                          {(a.vertical && VERTICAL_LABEL[a.vertical]) ||
                            a.industry}
                          {a.domain ? ` · ${a.domain}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip
                          label={STAGE_LABEL[life] ?? life}
                          tone={
                            life === "churned" || a.health === "risk"
                              ? "danger"
                              : life === "customer"
                                ? "mint"
                                : "neutral"
                          }
                        />
                      </td>
                      <td className="min-w-[160px] px-4 py-3 text-xs text-fg-muted">
                        <span className="block font-medium text-ink">
                          {a.primaryContactName ?? "—"}
                        </span>
                        <span className="block truncate">
                          {a.primaryContactEmail ||
                            a.primaryContactPhone ||
                            "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-fg-muted">
                        {[a.city, a.state].filter(Boolean).join(", ") ||
                          a.region}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-fg-muted">
                        {a.ownerEmail || OWNER_LABEL[a.ownerId] || "Unassigned"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular text-fg-muted">
                        {formatRelative(a.lastTouch, DEMO_NOW)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular">
                        {a.qualificationScore != null
                          ? a.qualificationScore
                          : a.arr
                            ? formatMoney(a.arr)
                            : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-border-soft px-4 py-2.5 text-xs text-fg-muted">
            <span className="font-mono tabular">
              {page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, total)} of{" "}
              {total.toLocaleString()}
              {wire.data?.source ? ` · ${wire.data.source}` : ""}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className={cn(
                  "rounded-md border border-border-soft p-1.5",
                  page <= 0
                    ? "opacity-40"
                    : "hover:border-product-mint/40",
                )}
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="flex items-center px-2 font-mono tabular">
                {page + 1}/{pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount - 1}
                onClick={() =>
                  setPage((p) => Math.min(pageCount - 1, p + 1))
                }
                className={cn(
                  "rounded-md border border-border-soft p-1.5",
                  page >= pageCount - 1
                    ? "opacity-40"
                    : "hover:border-product-mint/40",
                )}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
