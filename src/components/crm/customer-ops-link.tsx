import { ExternalLink } from "lucide-react";

/** Only an explicit Platform client relationship opens a specific customer. */
export function CustomerOpsLink({
  clientId,
  loading = false,
}: {
  clientId?: string | null;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-soft bg-card px-3 py-3 text-xs">
      <div>
        <p className="font-semibold text-ink">Customer operations</p>
        <p className="mt-0.5 text-fg-muted">
          {loading
            ? "Checking the linked account..."
            : clientId
              ? "Linked to this customer's Platform record."
              : "No confirmed Platform customer link on this account."}
        </p>
      </div>
      <a
        href={
          clientId
            ? `https://ops.rivvetai.com/customers?client=${encodeURIComponent(clientId)}`
            : "https://ops.rivvetai.com/customers"
        }
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-product-mint hover:underline"
      >
        {clientId ? "Open customer in Ops" : "Browse Ops customers"}
        <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
