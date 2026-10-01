import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/crm/page-header";
import { ViewTabs, LEAD_VIEWS } from "@/components/crm/view-tabs";
import { LeadFilters } from "@/components/crm/lead-filters";
import { LeadBookFunnel } from "@/components/crm/lead-funnel";
import { PriorityBadge } from "@/components/crm/priority-badge";
import { StatusChip } from "@/components/crm/status-chip";
import { EmptyState } from "@/components/crm/empty-state";
import { CallQueue } from "@/components/crm/call-queue";
import { DEMO_NOW } from "@/lib/crm/seed";
import {
  defaultLeadFilters,
  type LeadFilterState,
} from "@/lib/crm/filters";
import {
  formatMoney,
  formatRelative,
  leadPriority,
  OWNER_LABEL,
} from "@/lib/crm/priority";
import {
  LIFECYCLE_LABEL,
  VERTICAL_LABEL,
  isInInstantly,
  isSequenceReady,
} from "@/lib/crm/lead-model";
import type { ListView } from "@/lib/crm/types";
import { cn } from "@/components/ui/cn";
import { useLeadBook, useLeadsList } from "@/lib/crm/wire";
import { useCrmStore } from "@/lib/crm/store";
import { DEFAULT_PAGE_LIMIT } from "@/lib/crm/sequence-queries";

export const Route = createFileRoute("/_app/leads/")({
  component: LeadsPage,
});

function LeadsPage() {
  const [view, setView] = useState<ListView>("call_queue");
  const [filters, setFilters] = useState<LeadFilterState>(defaultLeadFilters);
  const [showBook, setShowBook] = useState(false);
  const [page, setPage] = useState(0);

  const bookQ = useLeadBook();
  const book = bookQ.data?.book;

  const listInput = useMemo(
    () => ({
      view,
      vertical: filters.vertical,
      state: filters.state,
      emailVerify: filters.emailVerify,
      lifecycle: filters.lifecycle,
      query: filters.query,
      limit: DEFAULT_PAGE_LIMIT,
      offset: page * DEFAULT_PAGE_LIMIT,
    }),
    [view, filters, page],
  );

  const listQ = useLeadsList(listInput);
  const rows = listQ.data?.leads ?? [];
  const rememberLeads = useCrmStore((s) => s.rememberLeads);
  useEffect(() => {
    if (listQ.data?.leads) rememberLeads(listQ.data.leads);
  }, [listQ.data, rememberLeads]);
  const total = listQ.data?.total ?? 0;
  const source = listQ.data?.source ?? "mock";
  const pageCount = Math.max(1, Math.ceil(total / DEFAULT_PAGE_LIMIT));

  // Count chips from first-page total is wrong for all views — use lightweight
  // second queries only for current view badge; others show when selected.
  const counts = useMemo(
    () => ({
      [view]: total,
    }),
    [view, total],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Leads"
        description="Start with the call queue, or pick another view."
        action={
          <button
            type="button"
            onClick={() => setShowBook((v) => !v)}
            className="rounded-md border border-border-soft bg-card px-3 py-2 text-xs font-semibold shadow-soft hover:bg-mist"
          >
            {showBook ? "Hide totals" : "Show totals"}
          </button>
        }
      />

      {showBook && book && (
        <div className="mb-5">
          <LeadBookFunnel
            book={book}
            activeLifecycle={filters.lifecycle}
            activeVertical={filters.vertical}
            onLifecycle={(s) => {
              setFilters((f) => ({ ...f, lifecycle: s }));
              setPage(0);
            }}
            onVertical={(v) => {
              setFilters((f) => ({ ...f, vertical: v }));
              setPage(0);
            }}
          />
        </div>
      )}

      <div className="space-y-2.5">
        <ViewTabs
          value={view}
          onChange={(v) => {
            setView(v);
            setPage(0);
          }}
          counts={counts}
          views={LEAD_VIEWS}
        />
        {view !== "call_queue" && (
          <LeadFilters
            value={filters}
            onChange={(f) => {
              setFilters(f);
              setPage(0);
            }}
            resultCount={total}
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg-subtle">
        <p>
          {listQ.isFetching ? "Loading…" : `${total.toLocaleString()} matches`}
          {" · page "}
          {page + 1}/{pageCount}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-1 disabled:opacity-40"
          >
            <ChevronLeft className="size-3" /> Prev
          </button>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-1 disabled:opacity-40"
          >
            Next <ChevronRight className="size-3" />
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border-soft bg-card shadow-card">
        {listQ.isError ? (
          <EmptyState
            icon={Inbox}
            title="Lead query failed"
            body={String(listQ.error)}
          />
        ) : rows.length === 0 && !listQ.isLoading ? (
          <EmptyState
            icon={Inbox}
            title={view === "call_queue" ? "Nobody to call right now" : "No leads match"}
            body={
              view === "call_queue"
                ? "Openers with a phone show up here, and call-backs come back on their date."
                : "Try another view, or clear the search."
            }
          />
        ) : view === "call_queue" ? (
          <CallQueue leads={rows} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-border-soft bg-card-soft text-[10px] uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Priority</th>
                  <th className="px-3 py-2.5 font-medium">Lead</th>
                  <th className="px-3 py-2.5 font-medium">Trade</th>
                  <th className="px-3 py-2.5 font-medium">State</th>
                  <th className="px-3 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Stage</th>
                  <th className="px-3 py-2.5 font-medium">Campaign</th>
                  <th className="px-3 py-2.5 font-medium">Fit</th>
                  <th className="px-3 py-2.5 font-medium">Next</th>
                  <th className="px-3 py-2.5 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const pr = leadPriority(l, DEMO_NOW);
                  const seq = isSequenceReady(l);
                  const loaded = isInInstantly(l);
                  return (
                    <tr
                      key={l.id}
                      className={cn(
                        "border-b border-border-soft/80 last:border-0 hover:bg-mist/70",
                        l.lifecycle === "scraped" && "opacity-80",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <PriorityBadge priority={pr.priority} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          to="/leads/$leadId"
                          params={{ leadId: l.id }}
                          className="font-medium text-ink hover:text-product-mint"
                        >
                          {l.name}
                        </Link>
                        <p className="text-[11px] text-fg-subtle">
                          {l.company} ·{" "}
                          <span className="font-mono">{l.id}</span>
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-fg-muted">
                        {VERTICAL_LABEL[l.vertical] ?? l.vertical}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-fg-muted">
                        {l.state ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusChip
                          label={l.emailVerificationStatus}
                          tone={
                            l.emailVerificationStatus === "valid"
                              ? "mint"
                              : l.emailVerificationStatus === "pending"
                                ? "warn"
                                : l.emailVerificationStatus === "invalid"
                                  ? "danger"
                                  : "neutral"
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusChip
                          label={LIFECYCLE_LABEL[l.lifecycle] ?? l.lifecycle}
                          tone={
                            l.lifecycle === "scraped"
                              ? "neutral"
                              : loaded
                                ? "cyan"
                                : seq
                                  ? "mint"
                                  : "warn"
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5 text-[11px]">
                        {loaded ? (
                          <span className="font-medium text-product-mint">
                            {l.instantlyCampaignName ?? "Loaded"}
                          </span>
                        ) : seq ? (
                          <span className="text-warn">Ready · not loaded</span>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs font-semibold tabular">
                          {l.icpScore}
                          <span className="ml-1 text-[10px] font-medium text-fg-subtle">
                            {l.icpTier}
                          </span>
                        </span>
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2.5 text-xs">
                        <span className="text-ink">
                          {l.nextAction ??
                            (seq ? "Ready for email" : "—")}
                        </span>
                        <p className="font-mono text-[10px] text-fg-subtle">
                          {formatRelative(l.lastTouch, DEMO_NOW)} ·{" "}
                          {OWNER_LABEL[l.ownerId] ?? l.ownerId}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold tabular">
                        {l.amountHint ? formatMoney(l.amountHint) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
