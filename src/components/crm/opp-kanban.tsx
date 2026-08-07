import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { GripVertical } from "lucide-react";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW } from "@/lib/crm/seed";
import {
  KANBAN_STAGES,
  STAGE_LABEL,
  formatMoney,
  formatRelative,
  formatDate,
  oppPriority,
  priorityRank,
} from "@/lib/crm/priority";
import type { ListView, OppStage, Opportunity } from "@/lib/crm/types";
import { filterOpps } from "@/lib/crm/filters";
import { PriorityBadge } from "./priority-badge";
import { cn } from "@/components/ui/cn";
import { usePatchOpportunityStage } from "@/lib/crm/wire";

function shortId(id: string) {
  if (id.length <= 12) return id;
  return id.includes("-") ? id.slice(0, 8) : id.slice(0, 8);
}

export function OppKanban({
  listView,
  filterIds,
}: {
  listView: ListView;
  /** When set, only cards with these ids are shown (post view filter). */
  filterIds?: Set<string>;
}) {
  const opportunities = useCrmStore((s) => s.opportunities);
  const moveOppStage = useCrmStore((s) => s.moveOppStage);
  const dataSource = useCrmStore((s) => s.dataSource);
  const patchStage = usePatchOpportunityStage();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<OppStage | null>(null);

  const now = dataSource === "live" ? Date.now() : DEMO_NOW;

  const filtered = useMemo(() => {
    let list = filterOpps(opportunities, listView);
    if (filterIds) list = list.filter((o) => filterIds.has(o.id));
    return list;
  }, [opportunities, listView, filterIds]);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(
      KANBAN_STAGES.map((s) => [s, [] as Opportunity[]]),
    ) as Record<OppStage, Opportunity[]>;
    for (const o of filtered) {
      if (map[o.stage]) map[o.stage].push(o);
    }
    for (const s of KANBAN_STAGES) {
      map[s].sort((a, b) => {
        const pa = oppPriority(a, now);
        const pb = oppPriority(b, now);
        const r = priorityRank(pa.priority) - priorityRank(pb.priority);
        if (r !== 0) return r;
        return b.amount - a.amount;
      });
    }
    return map;
  }, [filtered, now]);

  function applyStage(id: string, stage: OppStage) {
    if (dataSource === "live") {
      patchStage.mutate({ opportunityId: id, stage });
    } else {
      moveOppStage(id, stage);
    }
  }

  function onDrop(stage: OppStage) {
    if (dragId) applyStage(dragId, stage);
    setDragId(null);
    setOverStage(null);
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-fg-subtle">
        Drag across stages.{" "}
        {dataSource === "live" ? (
          <span className="font-medium text-product-mint">
            LIVE — patches crm_opportunities.stage
          </span>
        ) : (
          <span className="font-medium text-ink">
            MOCK — local only (no prod side-effects)
          </span>
        )}
        . Contract send stays locked.
      </p>

      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="flex min-w-max gap-2.5 px-1">
          {KANBAN_STAGES.map((stage) => {
            const cards = byStage[stage];
            const total = cards.reduce((sum, o) => sum + o.amount, 0);
            const isOver = overStage === stage;
            const isClosed =
              stage === "closed_won" || stage === "closed_lost";

            return (
              <section
                key={stage}
                className={cn(
                  "flex w-[248px] shrink-0 flex-col rounded-xl border bg-card shadow-soft transition-colors",
                  isOver
                    ? "border-bright-mint/60 bg-bright-mint/5"
                    : "border-border-soft",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverStage(stage);
                }}
                onDragLeave={() => {
                  setOverStage((cur) => (cur === stage ? null : cur));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(stage);
                }}
              >
                <header className="border-b border-border-soft px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wide",
                        stage === "closed_won" && "text-product-mint",
                        stage === "closed_lost" && "text-danger",
                        !isClosed && "text-ink",
                      )}
                    >
                      {STAGE_LABEL[stage]}
                    </h3>
                    <span className="font-mono text-[11px] tabular text-fg-subtle">
                      {cards.length}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] tabular text-fg-muted">
                    {formatMoney(total)}
                  </p>
                </header>

                <div className="flex min-h-[100px] flex-1 flex-col gap-1.5 p-1.5">
                  {cards.length === 0 && (
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-soft px-2 py-5 text-center text-[11px] text-fg-subtle">
                      Drop
                    </div>
                  )}
                  {cards.map((o) => {
                    const pr = oppPriority(o, now);
                    const dragging = dragId === o.id;
                    return (
                      <article
                        key={o.id}
                        draggable
                        onDragStart={(e) => {
                          setDragId(o.id);
                          e.dataTransfer.setData("text/plain", o.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverStage(null);
                        }}
                        className={cn(
                          "rounded-lg border border-border-soft bg-card-soft/90 p-2 shadow-soft transition",
                          "hover:border-product-mint/35 hover:bg-mist",
                          dragging && "opacity-40 ring-2 ring-bright-mint/40",
                        )}
                      >
                        <div className="mb-1 flex items-start gap-1">
                          <GripVertical
                            className="mt-0.5 size-3 shrink-0 text-fg-subtle"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <PriorityBadge priority={pr.priority} />
                              <span className="font-mono text-[10px] text-fg-subtle">
                                {shortId(o.id)}
                              </span>
                            </div>
                            <Link
                              to="/opportunities/$oppId"
                              params={{ oppId: o.id }}
                              className="mt-0.5 block text-[13px] font-medium leading-snug text-ink hover:text-product-mint"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {o.name}
                            </Link>
                            <p className="truncate text-[11px] text-fg-subtle">
                              {o.accountName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pl-4">
                          <span className="font-mono text-xs font-semibold tabular text-ink">
                            {formatMoney(o.amount)}
                          </span>
                          <span className="font-mono text-[10px] tabular text-fg-subtle">
                            {formatDate(o.closeDate)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate pl-4 text-[10px] text-fg-muted">
                          {o.nextAction ?? (
                            <span className="text-danger">No next step</span>
                          )}
                          {" · "}
                          {formatRelative(o.lastTouch, now)}
                        </p>
                        <div className="mt-1.5 pl-4 sm:hidden">
                          <select
                            value={o.stage}
                            onChange={(e) =>
                              applyStage(o.id, e.target.value as OppStage)
                            }
                            className="w-full rounded-md border border-border-soft bg-card px-2 py-1 text-[11px] text-ink"
                          >
                            {KANBAN_STAGES.map((s) => (
                              <option key={s} value={s}>
                                {STAGE_LABEL[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
