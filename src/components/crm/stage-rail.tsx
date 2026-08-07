import type { OppStage } from "@/lib/crm/types";
import { OPEN_STAGES, STAGE_LABEL } from "@/lib/crm/priority";
import { cn } from "@/components/ui/cn";

const ALL: OppStage[] = [
  ...OPEN_STAGES,
  "closed_won",
  "closed_lost",
];

export function StageRail({ stage }: { stage: OppStage }) {
  const idx = ALL.indexOf(stage);
  const closed = stage === "closed_won" || stage === "closed_lost";

  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-[520px] gap-1">
        {ALL.map((s, i) => {
          const active = s === stage;
          const past = !closed && i < idx;
          const lost = stage === "closed_lost" && s === "closed_lost";
          const won = stage === "closed_won" && s === "closed_won";
          return (
            <li
              key={s}
              className={cn(
                "flex-1 rounded-md border px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wide",
                active && !closed && "border-signal-cyan/50 bg-signal-cyan/10 text-ink",
                past && "border-product-mint/30 bg-product-mint/10 text-product-mint",
                won && "border-product-mint/50 bg-product-mint/15 text-product-mint",
                lost && "border-danger/40 bg-danger/10 text-danger",
                !active && !past && !won && !lost && "border-border-soft bg-mist text-fg-subtle",
              )}
            >
              {STAGE_LABEL[s]}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[10px] text-fg-subtle">
        Stage transitions are read-only here — production stage side-effects stay locked.
      </p>
    </div>
  );
}
