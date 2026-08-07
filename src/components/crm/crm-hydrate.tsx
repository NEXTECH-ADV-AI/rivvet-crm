import { useCrmHydrate } from "@/lib/crm/wire";
import { useCrmStore } from "@/lib/crm/store";
import { cn } from "@/components/ui/cn";

/** Loads LIVE or MOCK book into the client store once per session. */
export function CrmHydrateBanner() {
  const q = useCrmHydrate();
  const dataSource = useCrmStore((s) => s.dataSource);
  const message = useCrmStore((s) => s.hydrateMessage);

  if (q.isLoading) {
    return (
      <div className="border-b border-border-soft bg-mist px-4 py-1.5 text-center font-mono text-[10px] text-fg-subtle">
        Hydrating CRM book…
      </div>
    );
  }

  if (!message) return null;

  return (
    <div
      className={cn(
        "border-b px-4 py-1.5 text-center font-mono text-[10px]",
        dataSource === "live"
          ? "border-product-mint/25 bg-product-mint/10 text-ink"
          : "border-border-soft bg-mist text-fg-muted",
      )}
    >
      <span
        className={cn(
          "mr-2 rounded-full border px-1.5 py-0.5 font-semibold uppercase tracking-wide",
          dataSource === "live"
            ? "border-product-mint/40 text-product-mint"
            : "border-border-soft text-fg-subtle",
        )}
      >
        {dataSource === "live" ? "LIVE" : "MOCK"}
      </span>
      {message}
    </div>
  );
}
