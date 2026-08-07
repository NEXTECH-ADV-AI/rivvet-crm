import { useWireStatus } from "@/lib/crm/wire";
import { useCrmStore } from "@/lib/crm/store";
import { cn } from "@/components/ui/cn";
import { Link } from "@tanstack/react-router";

/** Shows mock vs live data plane — prefer hydrated store over static env check */
export function WireBanner() {
  const { data, isLoading, isError } = useWireStatus();
  const dataSource = useCrmStore((s) => s.dataSource);
  const hydrateMessage = useCrmStore((s) => s.hydrateMessage);

  if (isLoading && !data && dataSource === "seed") return null;

  const live = dataSource === "live" || data?.source === "live";
  const message =
    hydrateMessage ||
    data?.message ||
    (live ? "LIVE pipeline" : "Mock seed");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b px-4 py-1.5 text-[11px] sm:px-6 lg:px-8",
        live
          ? "border-product-mint/30 bg-product-mint/10 text-ink"
          : "border-border-soft bg-mist/80 text-fg-muted",
      )}
    >
      <p>
        <span className="font-semibold uppercase tracking-wide">
          {live ? "Live wire" : "Mock seed"}
        </span>
        <span className="mx-1.5 text-fg-subtle">·</span>
        {message}
        {!live && data?.blockReason ? (
          <span className="text-fg-subtle"> ({data.blockReason})</span>
        ) : null}
      </p>
      <Link
        to="/settings"
        className="font-medium text-product-mint hover:underline"
      >
        {live ? "Data plane" : "Connect LIVE"}
      </Link>
      {isError && <span className="text-danger">Wire status failed</span>}
    </div>
  );
}
