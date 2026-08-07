import { useWireStatus } from "@/lib/crm/wire";
import { cn } from "@/components/ui/cn";
import { Link } from "@tanstack/react-router";

/** Shows mock vs live data plane */
export function WireBanner() {
  const { data, isLoading, isError } = useWireStatus();
  if (isLoading || !data) return null;

  const live = data.source === "live";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b px-4 py-1.5 text-[11px] sm:px-6 lg:px-8",
        live
          ? "border-product-mint/30 bg-product-mint/10 text-ink"
          : "border-warn/30 bg-warn/10 text-ink",
      )}
    >
      <p>
        <span className="font-semibold uppercase tracking-wide">
          {live ? "Live wire" : "Mock seed"}
        </span>
        <span className="mx-1.5 text-fg-subtle">·</span>
        {data.message}
        {!live && data.blockReason ? (
          <span className="ml-1 font-mono text-[10px] text-fg-muted">
            ({data.blockReason})
          </span>
        ) : null}
      </p>
      <Link
        to="/settings"
        className="font-medium text-product-mint hover:underline"
      >
        Connect LIVE
      </Link>
      {isError && (
        <span className="text-danger">Wire status failed</span>
      )}
    </div>
  );
}
