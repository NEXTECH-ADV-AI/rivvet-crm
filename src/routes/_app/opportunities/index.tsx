import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Columns3, List, Target } from "lucide-react";
import { PageHeader } from "@/components/crm/page-header";
import { ViewTabs } from "@/components/crm/view-tabs";
import {
  FilterBar,
  type OwnerFilter,
  type PriorityFilter,
} from "@/components/crm/filter-bar";
import { PriorityBadge } from "@/components/crm/priority-badge";
import { StatusChip } from "@/components/crm/status-chip";
import { EmptyState } from "@/components/crm/empty-state";
import { OppKanban } from "@/components/crm/opp-kanban";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW } from "@/lib/crm/seed";
import { filterOpps } from "@/lib/crm/filters";
import {
  formatMoney,
  formatRelative,
  formatDate,
  oppPriority,
  OWNER_LABEL,
  STAGE_LABEL,
} from "@/lib/crm/priority";
import type { ListView, Opportunity } from "@/lib/crm/types";
import { cn } from "@/components/ui/cn";

export const Route = createFileRoute("/_app/opportunities/")({
  component: OppsPage,
});

type LayoutMode = "board" | "list";

function shortId(id: string) {
  if (id.length <= 12) return id;
  return id.includes("-") ? id.slice(0, 8) : id.slice(0, 8);
}

function applyLocalFilters(
  rows: Opportunity[],
  query: string,
  priority: PriorityFilter,
  owner: OwnerFilter,
  now: number,
) {
  const q = query.trim().toLowerCase();
  return rows.filter((o) => {
    if (owner !== "all" && o.ownerId !== owner) return false;
    if (priority !== "all") {
      if (oppPriority(o, now).priority !== priority) return false;
    }
    if (!q) return true;
    return (
      o.name.toLowerCase().includes(q) ||
      o.accountName.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      (o.nextAction?.toLowerCase().includes(q) ?? false)
    );
  });
}

function OppsPage() {
  const opportunities = useCrmStore((s) => s.opportunities);
  const dataSource = useCrmStore((s) => s.dataSource);
  // Full pipeline by default — "My open" was only 2 QA-looking rows
  const [view, setView] = useState<ListView>("all");
  const [layout, setLayout] = useState<LayoutMode>("board");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [owner, setOwner] = useState<OwnerFilter>("all");

  const now = dataSource === "live" ? Date.now() : DEMO_NOW;

  const base = useMemo(
    () => filterOpps(opportunities, view),
    [opportunities, view],
  );
  const rows = useMemo(
    () => applyLocalFilters(base, query, priority, owner, now),
    [base, query, priority, owner, now],
  );
  const filterIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const counts = useMemo(
    () => ({
      my_open: filterOpps(opportunities, "my_open").length,
      stale_7d: filterOpps(opportunities, "stale_7d").length,
      closing_month: filterOpps(opportunities, "closing_month").length,
      all: filterOpps(opportunities, "all").length,
    }),
    [opportunities],
  );

  return (
    <div
      className={cn(
        "mx-auto",
        layout === "board" ? "max-w-[1600px]" : "max-w-6xl",
      )}
    >
      <PageHeader
        eyebrow="Pipeline"
        title="Opportunities"
        description={
          dataSource === "live"
            ? "Live crm_opportunities · drag stages · send path locked."
            : "Board or list. Filters compose with saved views. Stage moves stay local."
        }
        action={
          <div className="flex rounded-lg border border-border-soft bg-card-soft p-0.5">
            <button
              type="button"
              onClick={() => setLayout("board")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                layout === "board"
                  ? "bg-card text-ink shadow-soft"
                  : "text-fg-muted hover:text-ink",
              )}
            >
              <Columns3 className="size-3.5" />
              Board
            </button>
            <button
              type="button"
              onClick={() => setLayout("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                layout === "list"
                  ? "bg-card text-ink shadow-soft"
                  : "text-fg-muted hover:text-ink",
              )}
            >
              <List className="size-3.5" />
              List
            </button>
          </div>
        }
      />
      <div className="space-y-2.5">
        <ViewTabs value={view} onChange={setView} counts={counts} />
        <FilterBar
          query={query}
          onQuery={setQuery}
          priority={priority}
          onPriority={setPriority}
          owner={owner}
          onOwner={setOwner}
          resultCount={rows.length}
        />
      </div>

      {layout === "board" ? (
        <div className="mt-4">
          <OppKanban listView={view} filterIds={filterIds} />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border-soft bg-card shadow-card">
          {rows.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No opportunities match"
              body="Reset filters or switch saved view."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-border-soft bg-card-soft text-[10px] uppercase tracking-wider text-fg-subtle">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Priority</th>
                    <th className="px-4 py-2.5 font-medium">Opportunity</th>
                    <th className="px-4 py-2.5 font-medium">Stage</th>
                    <th className="px-4 py-2.5 font-medium">Send</th>
                    <th className="px-4 py-2.5 font-medium">Owner</th>
                    <th className="px-4 py-2.5 font-medium">Next action</th>
                    <th className="px-4 py-2.5 font-medium">Close</th>
                    <th className="px-4 py-2.5 font-medium text-right">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => {
                    const pr = oppPriority(o, now);
                    return (
                      <tr
                        key={o.id}
                        className="border-b border-border-soft/80 last:border-0 hover:bg-mist/70"
                      >
                        <td className="px-4 py-3">
                          <PriorityBadge priority={pr.priority} />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to="/opportunities/$oppId"
                            params={{ oppId: o.id }}
                            className="font-medium text-ink hover:text-product-mint"
                          >
                            {o.name}
                          </Link>
                          <p className="text-[11px] text-fg-subtle">
                            {o.accountName} ·{" "}
                            <span className="font-mono">{shortId(o.id)}</span>
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip
                            label={STAGE_LABEL[o.stage] ?? o.stage}
                            tone={
                              o.stage === "closed_won"
                                ? "mint"
                                : o.stage === "closed_lost"
                                  ? "danger"
                                  : "neutral"
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          {o.lockedSendState ? (
                            <StatusChip
                              label={o.lockedSendState}
                              tone={
                                o.lockedSendState === "signed"
                                  ? "mint"
                                  : o.lockedSendState === "sent" ||
                                      o.lockedSendState === "viewed"
                                    ? "cyan"
                                    : "neutral"
                              }
                            />
                          ) : (
                            <span className="text-xs text-fg-subtle">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {OWNER_LABEL[o.ownerId]}
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-3">
                          <span
                            className={
                              o.nextAction
                                ? "text-ink"
                                : "font-medium text-danger"
                            }
                          >
                            {o.nextAction ?? "Set next step"}
                          </span>
                          <p className="font-mono text-[10px] text-fg-subtle">
                            {formatRelative(o.lastTouch, now)}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular text-fg-muted">
                          {formatDate(o.closeDate)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular">
                          <div>{formatMoney(o.monthlyAmount ?? 0)}/mo</div>
                          <div className="font-normal text-fg-subtle">
                            {formatMoney(o.amount)} TCV
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
