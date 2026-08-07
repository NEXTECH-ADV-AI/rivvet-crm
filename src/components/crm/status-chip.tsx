import { cn } from "@/components/ui/cn";

export function StatusChip({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: "neutral" | "mint" | "warn" | "danger" | "cyan";
  className?: string;
}) {
  const tones = {
    neutral: "bg-card-soft text-fg-muted border-border-soft",
    mint: "bg-bright-mint/15 text-product-mint border-product-mint/25",
    warn: "bg-warn/10 text-warn border-warn/25",
    danger: "bg-danger/10 text-danger border-danger/25",
    cyan: "bg-signal-cyan/10 text-ink border-signal-cyan/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
