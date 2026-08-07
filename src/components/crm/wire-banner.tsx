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
          : "border-border-soft bg-mist/80 text-fg-muted",
      )}
    >
      <p>
        <span className="font-semibold uppercase tracking-wide">
          {live ? "Live wire" : "Mock data"}
        </span>
        <span className="mx-1.5 text-fg-subtle">·</span>
        {data.message}
      </p>
      <Link
        to="/settings"
        className="font-medium text-product-mint hover:underline"
      >
        Data plane
      </Link>
      {isError && (
        <span className="text-danger">Wire status failed</span>
      )}
    </div>
  );
}
