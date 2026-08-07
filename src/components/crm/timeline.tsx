import {
  Phone,
  Mail,
  Calendar,
  CheckSquare,
  StickyNote,
  GitBranch,
  Bot,
} from "lucide-react";
import type { Activity } from "@/lib/crm/types";
import { DEMO_NOW } from "@/lib/crm/seed";
import { formatRelative, OWNER_LABEL } from "@/lib/crm/priority";
import { StatusChip } from "./status-chip";
import { cn } from "@/components/ui/cn";

const ICONS = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task: CheckSquare,
  note: StickyNote,
  stage_change: GitBranch,
  system: Bot,
};

export function Timeline({
  items,
  onComplete,
  className,
}: {
  items: Activity[];
  onComplete?: (id: string) => void;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-fg-subtle">
        No activity on this record yet.
      </p>
    );
  }

  return (
    <ol className={cn("space-y-0", className)}>
      {items.map((a, i) => {
        const Icon = ICONS[a.type] ?? StickyNote;
        const open = !a.completedAt && a.dueAt;
        return (
          <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < items.length - 1 && (
              <span
                className="absolute left-[15px] top-8 bottom-0 w-px bg-border-soft"
                aria-hidden
              />
            )}
            <div
              className={cn(
                "relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full border",
                open
                  ? "border-warn/40 bg-warn/10 text-warn"
                  : "border-border-soft bg-mist text-fg-muted",
              )}
            >
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1 rounded-lg border border-border-soft bg-card-soft/50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip label={a.type.replace("_", " ")} tone="neutral" />
                <span className="font-mono text-[10px] text-fg-subtle">{a.id}</span>
                {open && <StatusChip label="Open" tone="warn" />}
              </div>
              <p className="mt-1 text-sm font-medium text-ink">{a.subject}</p>
              {a.body && (
                <p className="mt-0.5 text-xs text-fg-muted line-clamp-2">{a.body}</p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle">
                <span>{OWNER_LABEL[a.ownerId] ?? a.ownerId}</span>
                <span>·</span>
                <span className="font-mono tabular">
                  {formatRelative(a.createdAt, DEMO_NOW)}
                </span>
                {a.dueAt && !a.completedAt && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-warn">Due {a.dueAt}</span>
                  </>
                )}
              </div>
              {open && onComplete && (
                <button
                  type="button"
                  onClick={() => onComplete(a.id)}
                  className="mt-2 rounded-md border border-border-soft bg-card px-2 py-1 text-[11px] font-semibold text-ink hover:bg-mist"
                >
                  Mark done
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
