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
    <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs ${failed ? "border-amber-300 bg-amber-50 text-amber-900" : "border-border-soft bg-card text-fg-muted"}`}>
      <span role={failed ? "alert" : "status"}>{status}</span>
      {overview ? <button type="button" disabled={q.isFetching} onClick={() => { void q.refetch(); void qc.refetchQueries({ queryKey: ["crm", "book"], type: "active" }); void qc.refetchQueries({ queryKey: ["crm", "founder-morning-brief"], type: "active" }); }} className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-semibold hover:bg-mist disabled:opacity-50" aria-label="Refresh CRM overview">
        <RefreshCw className={`size-3 ${q.isFetching ? "animate-spin" : ""}`} />{q.isFetching ? "Refreshing..." : "Refresh"}
      </button> : <span className="text-[10px] text-fg-subtle">Overview refresh pauses on record pages</span>}
    </div>
  );
}
