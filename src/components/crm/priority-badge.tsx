import type { Priority } from "@/lib/crm/types";
import { cn } from "@/components/ui/cn";

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
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide",
        styles[priority],
        className,
      )}
    >
      {priority}
    </span>
  );
}
