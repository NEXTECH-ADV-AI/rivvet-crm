import { Lock } from "lucide-react";

export function LockedBanner({
  title = "Revenue path — locked in this sandbox",
  body = "Deal builder, PandaDoc send, and Stripe/sign behavior are visual-only. No payloads, stage side-effects, or integrations are live.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-warn/30 bg-warn/8 px-3 py-2.5 text-sm text-ink">
      <Lock className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-fg-muted">{body}</p>
      </div>
    </div>
  );
}
