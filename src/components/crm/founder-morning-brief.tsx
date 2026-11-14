import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import { getFounderMorningBriefFn } from "@/lib/crm/morning-brief";

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

/** Mounted only on the founder's Home. No private snapshot enters the shared CRM store. */
export function FounderMorningBrief() {
  const q = useQuery({
    queryKey: ["crm", "founder-morning-brief", "brayden@rivvetai.com"],
    queryFn: () => getFounderMorningBriefFn(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    gcTime: 0,
    retry: false,
  });
  if (q.isLoading || q.data?.status === "hidden") return null;
  const data = !q.isError && q.data?.status === "ready" ? q.data.brief : null;
  return (
    <section
      className="mb-5 overflow-hidden rounded-xl border border-product-mint/30 bg-card shadow-soft"
      aria-label="Private morning brief"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-product-mint">
            Founder brief · preview
          </p>
          <h2 className="mt-1 text-sm font-semibold text-ink">Your morning priorities</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://rivvet-ceo-command-center.rivvet-ai-6921.chatgpt.site"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-product-mint hover:underline"
          >
            Open full morning brief
            <ExternalLink className="size-3" />
          </a>
          <button
            type="button"
            disabled={q.isFetching}
            onClick={() => void q.refetch()}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-fg-muted hover:bg-mist disabled:opacity-50"
            aria-label="Refresh private morning brief"
          >
            <RefreshCw className={`size-3 ${q.isFetching ? "animate-spin" : ""}`} />
            {q.isFetching ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      {!data ? (
        <p
          role={q.isError || q.data?.status === "unavailable" ? "status" : undefined}
          className="px-4 py-4 text-sm text-fg-muted"
        >
          {q.isLoading
            ? "Loading your private morning brief..."
            : q.data?.status === "unavailable"
              ? q.data.message
              : "The morning brief is unavailable. Existing CRM work remains below."}
        </p>
      ) : (
        <>
          <div className="px-4 py-4">
            <h3 className="break-words text-base font-semibold text-ink">{data.brief.title}</h3>
            {data.brief.subtitle && (
              <p className="mt-1 break-words text-xs text-fg-muted">{data.brief.subtitle}</p>
            )}
            <p className="mt-2 break-words text-sm leading-relaxed text-fg-muted">
              {data.brief.detail}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-fg-subtle">
              <span>Source brief: {stamp(data.generatedAt)}</span>
              <span>Preview synced: {stamp(data.syncedAt)}</span>
            </div>
          </div>
          {(data.stale || data.partial) && (
            <p
              role="status"
              className="border-y border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
            >
              {data.stale ? "This morning brief is stale or today's update is overdue. " : ""}
              {data.partial ? "Some sources are partial, stale or unavailable. " : ""}A recent
              preview sync does not make source information current. Check the source notes before
              acting.
            </p>
          )}
          <div className="grid gap-4 border-t border-border-soft p-4 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold text-ink">Recommended next steps</h3>
              <ol className="mt-2 space-y-3">
                {data.priorities.slice(0, 5).map((item, index) => (
                  <li key={`${index}:${item.title}`} className="rounded-lg bg-mist/60 p-3">
                    <p className="break-words text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 break-words text-xs leading-relaxed text-fg-muted">
                      {item.action}
                    </p>
                    <p className="mt-1 break-words text-[11px] text-fg-subtle">
                      {[item.owner, item.due, item.label].filter(Boolean).join(" · ")}
                    </p>
                    {item.url && (
                      <BriefLink href={item.url} label={item.sourceLabel || "Open source"} />
                    )}
                  </li>
                ))}
              </ol>
              {!data.priorities.length && (
                <p className="mt-2 text-xs text-fg-muted">
                  No priorities were included in this snapshot.
                </p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-ink">Customer follow-ups</h3>
              <ul className="mt-2 space-y-3">
                {data.customers.slice(0, 4).map((item, index) => (
                  <li key={`${index}:${item.name}`} className="rounded-lg bg-mist/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <p className="break-words text-sm font-semibold">{item.name}</p>
                      <span className="rounded bg-card px-1.5 py-0.5 text-[10px] font-semibold capitalize text-fg-muted">
                        {item.state}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-xs text-fg-muted">{item.action}</p>
                    <p className="mt-1 break-words text-[11px] text-fg-subtle">
                      {[item.status, item.lastContact].filter(Boolean).join(" · ")}
                    </p>
                    {item.url && <BriefLink href={item.url} label="Open conversation" />}
                    {item.issueUrl && <BriefLink href={item.issueUrl} label="Related work" />}
                  </li>
                ))}
              </ul>
              {!data.customers.length && (
                <p className="mt-2 text-xs text-fg-muted">
                  No customer follow-ups were included in this snapshot.
                </p>
              )}
            </div>
          </div>
          <details className="border-t border-border-soft px-4 py-3">
            <summary className="cursor-pointer text-xs font-semibold text-fg-muted">
              Source freshness and coverage
            </summary>
            <ul className="mt-3 space-y-2">
              {data.sources.map((source, index) => (
                <li key={`${index}:${source.name}`} className="text-xs">
                  <p className="font-semibold">
                    {source.name} · {source.status}
                  </p>
                  <p className="mt-0.5 text-fg-subtle">
                    {source.checkedAt ? `Checked ${stamp(source.checkedAt)}` : "Not checked"}
                  </p>
                  <p className="mt-0.5 break-words text-fg-muted">{source.note}</p>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

function BriefLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mr-3 mt-2 inline-flex items-center gap-1 text-xs font-semibold text-product-mint hover:underline"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}
