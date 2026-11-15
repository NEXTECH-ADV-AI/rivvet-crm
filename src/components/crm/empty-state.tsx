import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-14 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-mist text-fg-muted">
        <Icon className="size-5" />
      </div>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{body}</p>
    </div>
  );
}
