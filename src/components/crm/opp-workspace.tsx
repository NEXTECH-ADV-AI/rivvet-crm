import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Lock, Save, Send, Sparkles } from "lucide-react";
import { useCrmStore } from "@/lib/crm/store";
import {
  useCompleteTask,
  useLogTouch,
  usePatchOpportunityStage,
  useRecordActivities,
  useSaveOpportunity,
} from "@/lib/crm/wire";
import type { OpportunityRecord } from "@/lib/crm/wire/record-service.server";
import { formChanged, type OpportunityForm } from "@/lib/crm/opportunity-form";
import { DEMO_NOW } from "@/lib/crm/seed";
import {
  daysSince,
  formatDate,
  formatMoney,
  oppPriority,
  STAGE_LABEL,
  KANBAN_STAGES,
} from "@/lib/crm/priority";
import { ALL_VERTICALS, VERTICAL_LABEL } from "@/lib/crm/lead-model";
import {
  SERVICE_SKUS,
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
} from "@/lib/crm/prod-mirror";
import type { LostReason, OppStage } from "@/lib/crm/types";
import { Timeline } from "./timeline";
import { PriorityBadge, PRIORITY_HINT } from "./priority-badge";
import { cn } from "@/components/ui/cn";

/** Where an opportunity came from, in plain words. */
const SOURCE_LABEL: Record<string, string> = {
  legacy_gtm_leads: "From a lead",
  manual: "Added by hand",
  website: "From the website",
  legacy_deal: "From the earlier pipeline",
  crm_opportunities: "Added in the CRM",
};

export function OppWorkspace({ record }: { record: OpportunityRecord }) {
  const storeOpp = useCrmStore((s) => s.opportunities.find((o) => o.id === record.opportunity.id));
  const setDealConfig = useCrmStore((s) => s.setDealConfig);
  const moveOppStage = useCrmStore((s) => s.moveOppStage);
  const dataSource = useCrmStore((s) => s.dataSource);
  const patchStage = usePatchOpportunityStage();
  const save = useSaveOpportunity(record.opportunity.id);
  const logTouch = useLogTouch();
  const completeTask = useCompleteTask();
  const ref = { opportunityId: record.opportunity.id };
  const historyQ = useRecordActivities(ref, record.opportunity.id);

  // One explicit Save for every field below; stage saves the moment it changes, like dragging a card.
  const [form, setForm] = useState<OpportunityForm>(record.form);
  // Reset only when the stored values change, not on every refetch (a stage move), so edits survive.
  const storedKey = JSON.stringify(record.form);
  const [loaded, setLoaded] = useState(storedKey);
  if (loaded !== storedKey) {
    setLoaded(storedKey);
    setForm(record.form);
  }
  const dirty = formChanged(form, record.form);
  const set = <K extends keyof OpportunityForm>(k: K, v: OpportunityForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const [note, setNote] = useState("");

  // The order cards below still read the store's draft (they feed the locked send path).
  const opp = storeOpp ?? record.opportunity;
  const current = opp;

  function applyStage(stage: OppStage) {
    let lostReason: LostReason | null = null;
    if (stage === "closed_lost") {
      const pick = window.prompt(
        "Lost reason (no-show, no-fit, price, timing):",
        current.lostReason || "timing",
      );
      if (pick === null) return;
      const normalized = pick.trim().toLowerCase().replace(/\s+/g, "-");
      const allowed = ["no-show", "no-fit", "price", "timing"] as const;
      lostReason = (allowed as readonly string[]).includes(normalized)
        ? (normalized as LostReason)
        : "timing";
    }
    if (dataSource === "live" || !storeOpp) {
      patchStage.mutate({
        opportunityId: current.id,
        stage,
        lostReason,
      });
    } else {
      moveOppStage(current.id, stage, lostReason);
    }
  }

  const p = oppPriority(opp, DEMO_NOW);
  const priced = priceDeal(opp.deal);
  const stageDays = daysSince(opp.stageEnteredAt, DEMO_NOW);
  const pricedFull = priced;
  const serviceSkus = SERVICE_SKUS;
  const verticals = ALL_VERTICALS.includes(form.vertical as never) || !form.vertical ? ALL_VERTICALS : [...ALL_VERTICALS, form.vertical];
  const timeline = historyQ.data?.activities ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/opportunities"
            className="mb-1 inline-flex items-center gap-1 text-xs text-fg-muted hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> Opportunities
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {record.form.name}
            </h1>
            <select
              aria-label="Stage"
              value={opp.stage}
              onChange={(e) => applyStage(e.target.value as OppStage)}
              disabled={patchStage.isPending}
              className="rounded-full border border-border-soft bg-card px-2.5 py-0.5 text-xs font-medium text-ink disabled:opacity-60"
            >
              {KANBAN_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
            {patchStage.isError && (
              <span className="text-[11px] text-danger">
                Could not save stage — try again
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-fg-muted">
            {stageDays === 0 ? "Moved to this stage today" : `In this stage ${stageDays} day${stageDays === 1 ? "" : "s"}`} · Created {formatDate(opp.createdAt)} · {SOURCE_LABEL[opp.source] ?? "Added in the CRM"}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate(form, { onSuccess: (r) => setForm(r.record.form) })}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-soft enabled:hover:bg-deep-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="size-3.5" /> {save.isPending ? "Saving…" : "Save changes"}
          </button>
          <p role="status" className="text-[11px] text-fg-muted">
            {save.isError
              ? `Couldn't save: ${save.error instanceof Error ? save.error.message : "try again"}`
              : dirty
                ? "Unsaved changes"
                : save.isSuccess
                  ? "Saved"
                  : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Amount" value={formatMoney(record.form.amount ?? 0)} />
        <Kpi label="Expected close" value={record.form.closeDate ? formatDate(record.form.closeDate) : "Not set"} />
        <Kpi label="Next step due" value={record.form.nextStepDue ? formatDate(record.form.nextStepDue) : "Not set"} />
        <div className="rounded-2xl border border-border-soft bg-card px-3 py-2.5 shadow-soft">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">Priority</p>
          <PriorityBadge priority={p.priority} className="mt-1.5" />
          <p className="mt-1 text-[11px] text-fg-muted">{p.reasons[0] ?? PRIORITY_HINT[p.priority]}</p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-3">
          <Card title="Contact">
            {record.hasAccount && (
              <Field label="Company">
                <input value={form.company} onChange={(e) => set("company", e.target.value)} className="field" />
              </Field>
            )}
            <Field label="Name">
              <input
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
                disabled={!record.hasAccount}
                className="field"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                className="field"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                disabled={!record.hasAccount}
                className="field"
              />
            </Field>
            {record.hasAccount && (
              <Field label="Vertical">
                <select value={form.vertical} onChange={(e) => set("vertical", e.target.value)} className="field">
                  <option value="">Not set</option>
                  {verticals.map((v) => (
                    <option key={v} value={v}>
                      {VERTICAL_LABEL[v as keyof typeof VERTICAL_LABEL] ?? v}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </Card>
        </div>

        <div className="space-y-3 xl:col-span-5">
          <Card title="Opportunity">
            <Field label="Name">
              <input value={form.name} onChange={(e) => set("name", e.target.value)} className="field" />
            </Field>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Field label="Amount ($)">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.amount ?? ""}
                  onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="Not set"
                  className="field font-mono"
                />
              </Field>
              <Field label="Expected close">
                <input
                  type="date"
                  value={form.closeDate ?? ""}
                  onChange={(e) => set("closeDate", e.target.value || null)}
                  className="field font-mono"
                />
              </Field>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Field label="Next step">
                <input
                  value={form.nextStep}
                  onChange={(e) => set("nextStep", e.target.value)}
                  placeholder="e.g. Follow up Tuesday with pricing"
                  className="field"
                />
              </Field>
              <Field label="Due">
                <input
                  type="date"
                  value={form.nextStepDue ?? ""}
                  onChange={(e) => set("nextStepDue", e.target.value || null)}
                  className="field font-mono"
                />
              </Field>
            </div>
          </Card>

          <Card title="Notes">
            <textarea
              aria-label="New note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Discovery notes, objections, who decides…"
              className="field min-h-[80px] resize-y"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!note.trim() || logTouch.isPending}
                onClick={() => logTouch.mutate({ ...ref, type: "note", note }, { onSuccess: () => setNote("") })}
                className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-semibold text-white enabled:hover:bg-deep-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add note
              </button>
              <button
                type="button"
                disabled={logTouch.isPending}
                onClick={() => logTouch.mutate({ ...ref, type: "call", note }, { onSuccess: () => setNote("") })}
                className="rounded-md border border-border-soft px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-mist"
              >
                Log a call
              </button>
              <button
                type="button"
                disabled={logTouch.isPending}
                onClick={() => logTouch.mutate({ ...ref, type: "email", note }, { onSuccess: () => setNote("") })}
                className="rounded-md border border-border-soft px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-mist"
              >
                Log an email I sent
              </button>
            </div>
            {logTouch.isError && (
              <p role="alert" className="mt-2 text-xs text-danger">
                Couldn't save that. Try again.
              </p>
            )}
          </Card>

          <Card title="Activity">
            {historyQ.isError && <p className="mb-2 text-xs text-danger">Couldn't load the history. Refresh to try again.</p>}
            <Timeline items={timeline} onComplete={(id) => completeTask.mutate(id)} />
          </Card>

        </div>

        <div className="space-y-3 xl:col-span-4">
          <Card
            title={
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-signal-cyan" />
                Order builder
              </span>
            }
          >
            <div className="mb-3 flex gap-1 rounded-lg bg-mist p-0.5">
              {(
                [
                  ["commerce", "Commerce order", "Launch Partner agreement"],
                  ["rivvet_ai", "Rivvet AI order", "Rivvet AI plans"],
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
                Pick a Rivvet AI plan or set up the Commerce order to see the price.
              </p>
            )}
          </Card>

          <p className="rounded-xl border border-border-soft bg-mist/60 px-3 py-2.5 text-xs text-fg-muted">
            <Lock className="mr-1 inline size-3" />
            The order above is a draft on this screen and isn't saved. Contracts go out from the send page.
          </p>

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
            Open the send page →
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
