import { PriorityBadge } from "./priority-badge";
import { StatusChip } from "./status-chip";
import type { Priority } from "@/lib/crm/types";
import { OWNER_LABEL, formatRelative } from "@/lib/crm/priority";
import { DEMO_NOW } from "@/lib/crm/seed";
import { cn } from "@/components/ui/cn";

export function RecordHeader({
  title,
  subtitle,
  status,
  statusTone = "neutral",
  ownerId,
  nextAction,
  lastTouch,
  amount,
  priority,
  reasons,
  actions,
  sticky = true,
  idLabel,
}: {
  title: string;
  subtitle?: React.ReactNode;
  status: string;
  statusTone?: "neutral" | "mint" | "warn" | "danger" | "cyan";
  ownerId: string;
  nextAction: string | null;
  lastTouch: string;
  amount?: string | null;
  priority: Priority;
  reasons?: string[];
  actions?: React.ReactNode;
  sticky?: boolean;
  idLabel?: string;
}) {
  return (
    <header
      className={cn(
        "crm-surface p-4 sm:p-5",
        sticky && "sticky top-[6.5rem] z-10 sm:top-[6.75rem]",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={priority} />
            <StatusChip label={status} tone={statusTone} />
            {idLabel && (
              <span className="font-mono text-[10px] text-fg-subtle">
                {idLabel}
              </span>
            )}
            {amount && (
              <span className="font-mono text-sm font-semibold tabular text-ink">
                {amount}
              </span>
            )}
          </div>
          <div>
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-[1.35rem]">
              {title}
            </h1>
            {subtitle && (
              <div className="mt-0.5 text-sm text-fg-muted">{subtitle}</div>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border-soft pt-3.5 sm:grid-cols-4">
        <Meta label="Owner" value={OWNER_LABEL[ownerId] ?? ownerId} />
        <Meta
          label="Last touch"
          value={formatRelative(lastTouch, DEMO_NOW)}
          mono
        />
        <Meta
          label="Next action"
          value={nextAction ?? "Set next step"}
          highlight={!nextAction}
          className="col-span-2"
        />
      </dl>
      {reasons && reasons.length > 0 && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-fg-subtle">
          <span className="font-medium text-fg-muted">Why {priority}:</span>{" "}
          {reasons.join(" · ")}
        </p>
      )}
    </header>
  );
}

function Meta({
  label,
  value,
  mono,
  highlight,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="crm-label">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-medium",
          mono && "font-mono tabular",
          highlight ? "text-danger" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
