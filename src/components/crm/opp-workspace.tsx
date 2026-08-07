import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Lock,
  MapPin,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW } from "@/lib/crm/seed";
import { activitiesForEntity } from "@/lib/crm/filters";
import {
  daysSince,
  formatDate,
  formatMoney,
  formatRelative,
  oppPriority,
  STAGE_LABEL,
  KANBAN_STAGES,
} from "@/lib/crm/priority";
import {
  ALL_VERTICALS,
  VERTICAL_LABEL,
} from "@/lib/crm/lead-model";
import {
  SERVICE_SKUS,
  FORECAST_OPTIONS,
  FREE_MONTH_OPTIONS,
  PAYMENT_OPTIONS,
  TERM_OPTIONS,
  priceDeal,
  commercePerfTerms,
  type DealBuilderTab,
  type PaymentCadence,
  type ServicePlanId,
} from "@/lib/crm/deal-catalog";
import {
  COMMERCE_PRODUCT_NAME,
  COMMERCE_PRODUCT_DESCRIPTION,
  COMMERCE_SETUP_FEE,
  COMMERCE_MONTHLY_RETAINER,
  PROD_LOST_REASONS,
} from "@/lib/crm/prod-mirror";
import type { LostReason } from "@/lib/crm/types";
import type {
  ForecastCategory,
  OppStage,
  Opportunity,
  Vertical,
} from "@/lib/crm/types";
import { Timeline } from "./timeline";
import { StatusChip } from "./status-chip";
import { cn } from "@/components/ui/cn";

export function OppWorkspace({ oppId }: { oppId: string }) {
  const opportunities = useCrmStore((s) => s.opportunities);
  const contacts = useCrmStore((s) => s.contacts);
  const activities = useCrmStore((s) => s.activities);
  const patchOpp = useCrmStore((s) => s.patchOpp);
  const setDealConfig = useCrmStore((s) => s.setDealConfig);
  const moveOppStage = useCrmStore((s) => s.moveOppStage);
  const completeActivity = useCrmStore((s) => s.completeActivity);
  const logTouch = useCrmStore((s) => s.logTouch);

  const opp = useMemo(
    () => opportunities.find((o) => o.id === oppId),
    [opportunities, oppId],
  );
  const contact = useMemo(
    () =>
      opp?.primaryContactId
        ? contacts.find((c) => c.id === opp.primaryContactId)
        : undefined,
    [contacts, opp],
  );
  const relatedContacts = useMemo(
    () =>
      opp
        ? contacts.filter(
            (c) =>
              c.accountId === opp.accountId ||
              c.id === opp.primaryContactId,
          )
        : [],
    [contacts, opp],
  );
  const timeline = useMemo(
    () => (opp ? activitiesForEntity(activities, "opportunity", opp.id) : []),
    [activities, opp],
  );

  if (!opp) return null;

  const p = oppPriority(opp, DEMO_NOW);
  const priced = priceDeal(opp.deal);
  const weighted = Math.round(opp.amount * (opp.probability / 100));
  const stageDays = daysSince(opp.stageEnteredAt, DEMO_NOW);
  const open = opp.stage !== "closed_won" && opp.stage !== "closed_lost";
  const pricedFull = priced;
  const serviceSkus = SERVICE_SKUS;

  return (
    <div className="mx-auto max-w-[1400px] space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/opportunities"
            className="mb-1 inline-flex items-center gap-1 text-xs text-fg-muted hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> Pipeline
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {opp.accountName}
            </h1>
            <select
              value={opp.stage}
              onChange={(e) => moveOppStage(opp.id, e.target.value as OppStage)}
              className="rounded-full border border-border-soft bg-card px-2.5 py-0.5 text-xs font-medium text-ink"
            >
              {KANBAN_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
            <select
              value={opp.vertical}
              onChange={(e) =>
                patchOpp(opp.id, { vertical: e.target.value as Vertical })
              }
              className="rounded-full border border-border-soft bg-card px-2.5 py-0.5 text-xs font-medium capitalize text-ink"
            >
              {ALL_VERTICALS.map((v) => (
                <option key={v} value={v}>
                  {VERTICAL_LABEL[v]}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 font-mono text-[11px] text-fg-subtle">
            about {stageDays}d in stage · {opp.source} · {opp.id}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-border-soft bg-card px-3 py-1.5 text-xs font-semibold text-ink shadow-soft"
        >
          <Save className="size-3.5" /> Save
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi
          label="Monthly"
          value={opp.monthlyAmount ? formatMoney(opp.monthlyAmount) : "—"}
        />
        <Kpi label="TCV" value={opp.amount ? formatMoney(opp.amount) : "—"} />
        <Kpi
          label="Weighted"
          value={opp.amount ? formatMoney(weighted) : "—"}
        />
        <Kpi label="Win prob" value={`${opp.probability}%`} />
        <Kpi
          label="Priority"
          value={String(opp.scorePriority)}
          accent={p.priority === "P1"}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-3">
          <Card title="Contact">
            <Field label="Company">
              <input readOnly value={opp.accountName} className="field" />
            </Field>
            <Field label="Name">
              <input
                readOnly
                value={
                  contact ? `${contact.firstName} ${contact.lastName}` : "—"
                }
                className="field"
              />
            </Field>
            <Field label="Email">
              <input
                readOnly
                value={contact?.email ?? "—"}
                className="field"
              />
            </Field>
            <Field label="Phone">
              <input
                readOnly
                value={contact?.phone ?? ""}
                placeholder="—"
                className="field"
              />
            </Field>
            <Field label="Vertical">
              <select
                value={opp.vertical}
                onChange={(e) =>
                  patchOpp(opp.id, { vertical: e.target.value as Vertical })
                }
                className="field"
              >
                {ALL_VERTICALS.map((v) => (
                  <option key={v} value={v}>
                    {VERTICAL_LABEL[v]}
                  </option>
                ))}
              </select>
            </Field>
            <p className="mt-2 flex items-center gap-1 text-xs text-fg-muted">
              <MapPin className="size-3" /> {opp.region || "—"}
            </p>
          </Card>

          <Card
            title="Contacts"
            right={
              <span className="font-mono text-[10px]">
                {relatedContacts.length}
              </span>
            }
          >
            <ul className="space-y-1.5">
              {relatedContacts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg bg-mist/70 px-2.5 py-2"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-product-mint/20 text-[10px] font-semibold text-product-mint">
                    {c.firstName[0]}
                    {c.lastName[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="truncate text-[11px] text-fg-subtle">
                      {c.email}
                    </p>
                  </div>
                  {c.isPrimary && <StatusChip label="Primary" tone="cyan" />}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Engagement">
            <div className="grid grid-cols-3 gap-1.5">
              <Eng label="Opened" value={opp.engagement.opened} />
              <Eng label="Replied" value={opp.engagement.replied} active />
              <Eng label="Calls" value={opp.engagement.calls} active />
            </div>
            <p className="mt-2 text-[11px] text-fg-subtle">
              Status: {STAGE_LABEL[opp.stage]}
            </p>
          </Card>
        </div>

        <div className="space-y-3 xl:col-span-5">
          <Card title="Forecast & pipeline">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Forecast category">
                <select
                  value={opp.forecastCategory}
                  onChange={(e) =>
                    patchOpp(opp.id, {
                      forecastCategory: e.target.value as ForecastCategory,
                    })
                  }
                  className="field"
                >
                  {FORECAST_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Expected close">
                <input
                  type="date"
                  value={opp.closeDate || ""}
                  onChange={(e) =>
                    patchOpp(opp.id, { closeDate: e.target.value })
                  }
                  className="field font-mono"
                />
              </Field>
            </div>
            <Field label="Next step" className="mt-2">
              <input
                value={opp.nextAction ?? ""}
                onChange={(e) =>
                  patchOpp(opp.id, {
                    nextAction: e.target.value || null,
                  })
                }
                placeholder="e.g. Follow up Tuesday with pricing"
                className="field"
              />
            </Field>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Field label="Probability">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={opp.probability}
                  onChange={(e) =>
                    patchOpp(opp.id, {
                      probability: Number(e.target.value) || 0,
                    })
                  }
                  className="field font-mono"
                />
              </Field>
              <Field label="Weighted">
                <div className="field font-mono text-fg-muted">
                  {formatMoney(weighted)}
                </div>
              </Field>
              <Field label="Category">
                <div className="field capitalize text-fg-muted">
                  {opp.forecastCategory.replace("_", " ")}
                </div>
              </Field>
            </div>
          </Card>

          <Card title="Notes">
            <textarea
              value={opp.notes}
              onChange={(e) => patchOpp(opp.id, { notes: e.target.value })}
              rows={5}
              placeholder="Discovery notes, follow-ups, objections, decision process…"
              className="field min-h-[120px] resize-y"
            />
          </Card>

          <Card title="Details">
            <Meta k="Source" v={opp.source} />
            <Meta k="Status" v={STAGE_LABEL[opp.stage]} />
            <Meta k="Created" v={formatDate(opp.createdAt)} />
            <Meta
              k="Priority chip"
              v={`${p.priority} · score ${opp.scorePriority}`}
            />
          </Card>

          <Card title="Calls">
            <p className="text-xs leading-relaxed text-fg-muted">
              No cold_call_result rows for this lead yet. Calls flow in from the
              ElevenLabs Call Sync workflow (15min cron) — mirror only in
              sandbox.
            </p>
            <button
              type="button"
              onClick={() =>
                logTouch(
                  "opportunity",
                  opp.id,
                  opp.name,
                  "call",
                  `Call logged — ${opp.accountName}`,
                )
              }
              className="mt-2 rounded-md border border-border-soft px-2.5 py-1.5 text-[11px] font-semibold hover:bg-mist"
            >
              Log call (local)
            </button>
          </Card>

          <Card title="Activity">
            <Timeline
              items={timeline.slice(0, 8)}
              onComplete={completeActivity}
            />
          </Card>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Card
            title={
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-signal-cyan" />
                Deal builder
              </span>
            }
          >
            <div className="mb-3 flex gap-1 rounded-lg bg-mist p-0.5">
              {(
                [
                  ["commerce", "Commerce Order", "Launch Partner contract"],
                  ["rivvet_ai", "Rivvet AI Order", "Rivvet AI deals"],
                ] as const
              ).map(([id, label, sub]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setDealConfig(opp.id, {
                      tab: id as DealBuilderTab,
                      productId:
                        id === "rivvet_ai" ? opp.deal.productId : null,
                    })
                  }
                  className={cn(
                    "flex-1 rounded-md px-2 py-2 text-left transition",
                    opp.deal.tab === id
                      ? "bg-card shadow-soft ring-1 ring-product-mint/30"
                      : "hover:bg-card/60",
                  )}
                >
                  <p className="text-[11px] font-semibold text-ink">{label}</p>
                  <p className="text-[10px] text-fg-subtle">{sub}</p>
                </button>
              ))}
            </div>

            {opp.deal.tab === "commerce" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-product-mint/30 bg-product-mint/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {COMMERCE_PRODUCT_NAME}
                      </p>
                      <p className="text-[11px] text-fg-muted">
                        {COMMERCE_PRODUCT_DESCRIPTION}
                      </p>
                    </div>
                    <div className="shrink-0 text-right font-mono text-xs">
                      <p className="font-semibold">
                        {formatMoney(opp.deal.commerceSetupFee)} setup
                      </p>
                      <p className="text-product-mint">
                        {formatMoney(opp.deal.commerceMonthlyRetainer)}/mo
                      </p>
                    </div>
                  </div>
                </div>
                <Field label="Setup fee">
                  <div className="flex items-center gap-2">
                    <span className="text-fg-subtle">$</span>
                    <input
                      type="number"
                      min={0}
                      value={opp.deal.commerceSetupFee}
                      onChange={(e) =>
                        setDealConfig(opp.id, {
                          commerceSetupFee: Math.max(
                            0,
                            Number(e.target.value) || 0,
                          ),
                        })
                      }
                      className="field font-mono"
                    />
                    <span className="shrink-0 text-[10px] text-fg-subtle">
                      std {formatMoney(COMMERCE_SETUP_FEE)}
                    </span>
                  </div>
                </Field>
                <Field label="Monthly retainer">
                  <div className="flex items-center gap-2">
                    <span className="text-fg-subtle">$</span>
                    <input
                      type="number"
                      min={0}
                      value={opp.deal.commerceMonthlyRetainer}
                      onChange={(e) =>
                        setDealConfig(opp.id, {
                          commerceMonthlyRetainer: Math.max(
                            0,
                            Number(e.target.value) || 0,
                          ),
                        })
                      }
                      className="field font-mono"
                    />
                    <span className="shrink-0 text-[10px] text-fg-subtle">
                      /mo · std {formatMoney(COMMERCE_MONTHLY_RETAINER)}
                    </span>
                  </div>
                </Field>
                <Field label="Performance election">
                  <select
                    value={opp.deal.performanceOption}
                    onChange={(e) =>
                      setDealConfig(opp.id, {
                        performanceOption: e.target
                          .value as typeof opp.deal.performanceOption,
                      })
                    }
                    className="field"
                  >
                    <option value="">Choose before sending…</option>
                    <option value="standard">
                      Option A — Standard · 5% / 12mo
                    </option>
                    <option value="test_run">
                      Option B — Test Run · 15% / 6mo
                    </option>
                    <option value="custom">Custom · set rate & term</option>
                  </select>
                </Field>
                {opp.deal.performanceOption === "custom" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Custom rate">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={opp.deal.customPerfRate}
                          onChange={(e) =>
                            setDealConfig(opp.id, {
                              customPerfRate: Number(e.target.value) || 0,
                            })
                          }
                          className="field font-mono"
                        />
                        <span className="text-[10px] text-fg-subtle">% net</span>
                      </div>
                    </Field>
                    <Field label="Custom term">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={opp.deal.customPerfTermMonths}
                          onChange={(e) =>
                            setDealConfig(opp.id, {
                              customPerfTermMonths:
                                Number(e.target.value) || 1,
                            })
                          }
                          className="field font-mono"
                        />
                        <span className="text-[10px] text-fg-subtle">mo</span>
                      </div>
                    </Field>
                  </div>
                )}
                {commercePerfTerms(opp.deal) && (
                  <p className="font-mono text-[11px] text-product-mint">
                    {commercePerfTerms(opp.deal)!.label}:{" "}
                    {commercePerfTerms(opp.deal)!.rate}% net sales ·{" "}
                    {commercePerfTerms(opp.deal)!.termMonths}mo from launch
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {serviceSkus.map((prod) => {
                  const selected = opp.deal.productId === prod.id;
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() =>
                        setDealConfig(opp.id, {
                          productId: prod.id as ServicePlanId,
                        })
                      }
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
                        selected
                          ? "border-product-mint/50 bg-product-mint/8"
                          : "border-border-soft bg-card hover:border-product-mint/30",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                          selected
                            ? "border-product-mint bg-product-mint"
                            : "border-border-soft",
                        )}
                      >
                        {selected && (
                          <span className="size-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">
                            {prod.name}
                          </p>
                          <p className="shrink-0 font-mono text-sm font-semibold tabular text-ink">
                            {formatMoney(prod.monthlyPrice)}/mo
                          </p>
                        </div>
                        <p className="text-[11px] text-fg-muted">
                          {prod.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Contract terms">
            {opp.deal.tab === "commerce" ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Effective date">
                  <input
                    type="date"
                    value={opp.deal.effectiveDate}
                    onChange={(e) =>
                      setDealConfig(opp.id, { effectiveDate: e.target.value })
                    }
                    className="field font-mono"
                  />
                </Field>
                <Field label="Launch target">
                  <input
                    type="date"
                    value={opp.deal.launchDateTarget}
                    onChange={(e) =>
                      setDealConfig(opp.id, {
                        launchDateTarget: e.target.value,
                      })
                    }
                    className="field font-mono"
                  />
                </Field>
                <p className="col-span-2 text-[11px] text-fg-muted">
                  Signing collects setup fee. Retainer + performance share start
                  on Public Launch Date.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Term">
                    <select
                      value={opp.deal.termMonths}
                      onChange={(e) =>
                        setDealConfig(opp.id, {
                          termMonths: Number(e.target.value) as 6 | 12 | 24,
                        })
                      }
                      className="field"
                    >
                      {TERM_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Free months">
                    <select
                      value={opp.deal.freeMonths}
                      onChange={(e) =>
                        setDealConfig(opp.id, {
                          freeMonths: Number(e.target.value) as 0 | 1 | 2 | 3,
                        })
                      }
                      className="field"
                    >
                      {FREE_MONTH_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Payment">
                    <select
                      value={opp.deal.payment}
                      onChange={(e) =>
                        setDealConfig(opp.id, {
                          payment: e.target.value as PaymentCadence,
                        })
                      }
                      className="field"
                    >
                      {PAYMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Start date">
                    <input
                      type="date"
                      value={opp.deal.startDate}
                      onChange={(e) =>
                        setDealConfig(opp.id, { startDate: e.target.value })
                      }
                      className="field font-mono"
                    />
                  </Field>
                </div>
                <Field label="Setup fee" className="mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-fg-subtle">$</span>
                    <input
                      type="number"
                      value={opp.deal.setupFee}
                      onChange={(e) =>
                        setDealConfig(opp.id, {
                          setupFee: Number(e.target.value) || 0,
                        })
                      }
                      className="field font-mono"
                    />
                    <span className="shrink-0 text-[11px] text-fg-subtle">
                      at signing
                    </span>
                  </div>
                </Field>
              </>
            )}
          </Card>

          <Card title="Pricing summary">
            {pricedFull.mode === "commerce" ? (
              <ul className="space-y-1.5 text-sm">
                <li className="flex justify-between gap-2">
                  <span className="text-fg-muted">{COMMERCE_PRODUCT_NAME}</span>
                  <span className="font-mono tabular">
                    {formatMoney(pricedFull.setupFee)} setup
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-fg-muted">Monthly retainer</span>
                  <span className="font-mono tabular">
                    {formatMoney(pricedFull.monthly)}/mo
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-fg-muted">Performance share</span>
                  <span className="font-mono tabular">
                    {pricedFull.perf
                      ? `${pricedFull.perf.rate}% / ${pricedFull.perf.termMonths}mo`
                      : "required"}
                  </span>
                </li>
                <li className="flex justify-between gap-2 border-t border-border-soft pt-2 font-semibold">
                  <span>TCV</span>
                  <span className="font-mono tabular text-product-mint">
                    {formatMoney(pricedFull.tcv)}
                  </span>
                </li>
              </ul>
            ) : pricedFull.productName ? (
              <ul className="space-y-1.5 text-sm">
                <li className="flex justify-between gap-2">
                  <span className="text-fg-muted">{pricedFull.productName}</span>
                  <span className="font-mono tabular">
                    {formatMoney(pricedFull.monthly)}/mo
                  </span>
                </li>
                <li className="text-xs text-fg-subtle">
                  {pricedFull.billableMonths} billable mo · {opp.deal.termMonths}{" "}
                  term
                  {opp.deal.freeMonths ? ` · ${opp.deal.freeMonths} free` : ""}
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-fg-muted">Setup</span>
                  <span className="font-mono tabular">
                    {formatMoney(pricedFull.setupFee)}
                  </span>
                </li>
                <li className="flex justify-between gap-2 border-t border-border-soft pt-2 font-semibold">
                  <span>TCV</span>
                  <span className="font-mono tabular text-product-mint">
                    {formatMoney(pricedFull.tcv)}
                  </span>
                </li>
              </ul>
            ) : (
              <p className="text-xs text-fg-muted">
                Select a Rivvet AI plan or configure Commerce to price the deal.
              </p>
            )}
          </Card>

          <div className="rounded-xl border border-product-mint/25 bg-product-mint/10 px-3 py-2.5 text-xs text-ink">
            <span className="font-semibold text-product-mint">
              Send authorized
            </span>
            <span className="text-fg-muted">
              {" "}
              · Mirror only — PandaDoc/Stripe locked (prod: sendContract +
              crm_create_contract_draft).
            </span>
          </div>

          {open && (
            <div className="rounded-xl border border-warn/25 bg-warn/5 px-3 py-2 text-[11px] text-fg-muted">
              <Lock className="mr-1 inline size-3 text-warn" />
              PandaDoc / Stripe send path is locked in sandbox — UI only.
            </div>
          )}

          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink/35 px-4 py-3 text-sm font-semibold text-white"
          >
            <Send className="size-4" />
            Send Contract
            <Lock className="size-3.5 opacity-70" />
          </button>

          <Link
            to="/opportunities/$oppId/send"
            params={{ oppId: opp.id }}
            className="block text-center text-[11px] font-medium text-product-mint hover:underline"
          >
            Open locked send shell →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  right,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-soft bg-card p-3.5 shadow-soft sm:p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border-soft bg-card px-3 py-2.5 shadow-soft">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-lg font-semibold tabular",
          accent ? "text-product-mint" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Eng({
  label,
  value,
  active,
}: {
  label: string;
  value: number | null;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-2 py-2 text-center",
        active
          ? "border-signal-cyan/30 bg-agent-soft"
          : "border-border-soft bg-mist/50",
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold tabular">
        {value == null ? "—" : value}
      </p>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border-soft/70 py-1.5 text-sm last:border-0">
      <span className="text-fg-muted">{k}</span>
      <span className="text-right font-mono text-xs text-ink">{v}</span>
    </div>
  );
}
