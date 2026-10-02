import type { Priority } from "@/lib/crm/types";
import { cn } from "@/components/ui/cn";

/** Plain words for P1/P2/P3 so nobody has to guess (RIV-1558). */
export const PRIORITY_LABEL: Record<Priority, string> = { P1: "Act today", P2: "This week", P3: "No rush" };
export const PRIORITY_HINT: Record<Priority, string> = {
  P1: "Needs you today: no next step, it's overdue, or it's at risk.",
  P2: "Worth a touch this week.",
  P3: "On track, or closed.",
};

const styles: Record<Priority, string> = {
  P1: "bg-p1/10 text-p1 border-p1/25",
  P2: "bg-warn/10 text-warn border-warn/25",
  P3: "bg-mist text-fg-subtle border-border-soft",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <span
      title={PRIORITY_HINT[priority]}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        styles[priority],
        className,
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
