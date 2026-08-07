import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/crm/page-header";
import { ViewTabs } from "@/components/crm/view-tabs";
import { PriorityBadge } from "@/components/crm/priority-badge";
import { StatusChip } from "@/components/crm/status-chip";
import { EmptyState } from "@/components/crm/empty-state";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW } from "@/lib/crm/seed";
import { filterAccounts } from "@/lib/crm/filters";
import {
  accountPriority,
  formatMoney,
  formatRelative,
  OWNER_LABEL,
  STAGE_LABEL,
} from "@/lib/crm/priority";
import type { ListView } from "@/lib/crm/types";

export const Route = createFileRoute("/_app/accounts/")({
  component: AccountsPage,
});

function AccountsPage() {
  const accounts = useCrmStore((s) => s.accounts);
  const [view, setView] = useState<ListView>("my_open");
  const rows = useMemo(() => filterAccounts(accounts, view), [accounts, view]);
  const counts = useMemo(
    () => ({
      my_open: filterAccounts(accounts, "my_open").length,
      stale_7d: filterAccounts(accounts, "stale_7d").length,
      closing_month: filterAccounts(accounts, "closing_month").length,
      all: filterAccounts(accounts, "all").length,
    }),
    [accounts],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Accounts"
        description="ARR, health, open opps — account table shape with local mutations only on next_action."
      />
      <ViewTabs value={view} onChange={setView} counts={counts} />

      <div className="mt-4 overflow-hidden rounded-xl border border-border-soft bg-card shadow-card">
        {rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No accounts in this view"
            body="Switch to All to see the full book."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-border-soft bg-card-soft text-[10px] uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Priority</th>
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Region</th>
                  <th className="px-4 py-2.5 font-medium">Owner</th>
                  <th className="px-4 py-2.5 font-medium">Next action</th>
                  <th className="px-4 py-2.5 font-medium">Last touch</th>
                  <th className="px-4 py-2.5 font-medium text-right">ARR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const p = accountPriority(a, DEMO_NOW);
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
                        <p className="text-[11px] text-fg-subtle">
                          {a.domain} · {a.industry}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip
                          label={STAGE_LABEL[a.status] ?? a.status}
                          tone={
                            a.status === "at_risk" || a.health === "risk"
                              ? "danger"
                              : "neutral"
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-fg-muted">
                        {a.region}
                      </td>
                      <td className="px-4 py-3 text-fg-muted">
                        {OWNER_LABEL[a.ownerId]}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3">
                        <span
                          className={
                            a.nextAction
                              ? "text-ink"
                              : "font-medium text-danger"
                          }
                        >
                          {a.nextAction ?? "Set next step"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular text-fg-muted">
                        {formatRelative(a.lastTouch, DEMO_NOW)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular">
                        {a.arr ? formatMoney(a.arr) : "—"}
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
