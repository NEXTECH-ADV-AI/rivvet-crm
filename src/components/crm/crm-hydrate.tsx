import { useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useCrmHydrate } from "@/lib/crm/wire";
import { useCrmStore } from "@/lib/crm/store";

/** Freshness is visible; automatic refresh is restricted to non-editing overviews. */
export function CrmHydrateBanner() {
  const q = useCrmHydrate();
  const qc = useQueryClient();
  const dataSource = useCrmStore((s) => s.dataSource);
  const message = useCrmStore((s) => s.hydrateMessage);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const overview = ["/home", "/analytics", "/activities"].includes(pathname.replace(/\/$/, ""));
  const partial = Boolean(message?.includes("unavailable"));
  const failed = q.isError || partial;
  const updated = q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
  const status = q.isLoading ? "Loading CRM data..."
    : q.isError ? "Refresh failed. Previously loaded data may be out of date."
    : dataSource !== "live" ? "Demo data. This preview is not connected to the live CRM."
    : partial ? "Some CRM data is unavailable. Check the affected sections."
    : `Live CRM · Updated ${updated}`;
  return (
    <div className={`flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] ${failed ? "rounded-sm bg-amber-50 px-3 text-amber-900 [--crm-focus-ring:var(--color-product-mint)]" : "text-white/70 md:text-fg-muted"}`}>
      <span role={failed ? "alert" : "status"}>{status}</span>
      {overview ? <button type="button" disabled={q.isFetching} onClick={() => { void q.refetch(); void qc.refetchQueries({ queryKey: ["crm", "book"], type: "active" }); void qc.refetchQueries({ queryKey: ["crm", "founder-morning-brief"], type: "active" }); }} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm px-3 py-2 font-semibold hover:bg-white/10 md:hover:bg-mist disabled:opacity-50" aria-label="Refresh CRM overview">
        <RefreshCw className={`size-3 ${q.isFetching ? "animate-spin" : ""}`} />{q.isFetching ? "Refreshing..." : "Refresh"}
      </button> : <span className="text-xs">Overview refresh pauses on record pages</span>}
    </div>
  );
}
