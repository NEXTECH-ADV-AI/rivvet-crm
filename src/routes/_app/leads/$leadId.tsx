import { useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { RecordHeader } from "@/components/crm/record-header";
import { Timeline } from "@/components/crm/timeline";
import { NextActionEditor } from "@/components/crm/next-action-editor";
import { MetaPanel, MetaRow, TagList } from "@/components/crm/meta-panel";
import { StatusChip } from "@/components/crm/status-chip";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW } from "@/lib/crm/seed";
import { activitiesForEntity } from "@/lib/crm/filters";
import {
  formatMoney,
  formatRelative,
  leadPriority,
} from "@/lib/crm/priority";
import {
  LIFECYCLE_LABEL,
  VERTICAL_LABEL,
  campaignForVertical,
  isInInstantly,
  isSequenceReady,
  isWorkableLead,
} from "@/lib/crm/lead-model";

export const Route = createFileRoute("/_app/leads/$leadId")({
  component: LeadDetail,
});

function LeadDetail() {
  const { leadId } = Route.useParams();
  const leads = useCrmStore((s) => s.leads);
  const activities = useCrmStore((s) => s.activities);
  const setLeadNextAction = useCrmStore((s) => s.setLeadNextAction);
  const completeActivity = useCrmStore((s) => s.completeActivity);
  const logTouch = useCrmStore((s) => s.logTouch);

  const lead = useMemo(
    () => leads.find((l) => l.id === leadId),
    [leads, leadId],
  );
  const timeline = useMemo(
    () => (lead ? activitiesForEntity(activities, "lead", lead.id) : []),
    [activities, lead],
  );

  if (!lead) throw notFound();
  const p = leadPriority(lead, DEMO_NOW);
  const seq = isSequenceReady(lead);
  const loaded = isInInstantly(lead);
  const salesReady = isWorkableLead(lead);
  const icpMax = 20;
  const targetCamp = campaignForVertical(lead.vertical);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to="/leads"
        className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Leads
      </Link>

      <RecordHeader
        title={lead.name}
        idLabel={lead.id}
        subtitle={`${lead.title} · ${lead.company} · ${VERTICAL_LABEL[lead.vertical]} · ${lead.state ?? "—"}`}
        status={LIFECYCLE_LABEL[lead.lifecycle]}
        statusTone={
          lead.lifecycle === "scraped"
            ? "neutral"
            : loaded
              ? "cyan"
              : seq
                ? "mint"
                : lead.lifecycle === "disqualified"
                  ? "danger"
                  : "warn"
        }
        ownerId={lead.ownerId}
        nextAction={lead.nextAction}
        lastTouch={lead.lastTouch}
        amount={lead.amountHint ? formatMoney(lead.amountHint) : null}
        priority={p.priority}
        reasons={p.reasons}
        actions={
          seq && !loaded ? (
            <span className="rounded-md border border-product-mint/30 bg-product-mint/10 px-3 py-2 text-xs font-semibold text-product-mint">
              Sequence-ready · load via n8n GO
              {targetCamp ? ` → ${targetCamp}` : ""}
            </span>
          ) : loaded ? (
            <button
              type="button"
              onClick={() =>
                logTouch(
                  "lead",
                  lead.id,
                  lead.name,
                  "email",
                  `Email follow-up — ${lead.name}`,
                )
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-deep-ink"
            >
              <Mail className="size-3.5" /> Log email
            </button>
          ) : (
            <span className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">
              Not sequence-ready — enrich / verify first
            </span>
          )
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Gate
          label="Enriched"
          ok={
            lead.enrichmentStatus !== "none" &&
            lead.enrichmentStatus !== "failed"
          }
          detail={lead.enrichmentStatus}
        />
        <Gate
          label="Valid email"
          ok={lead.emailVerificationStatus === "valid"}
          detail={lead.emailVerificationStatus}
        />
        <Gate
          label="Seq vertical"
          ok={Boolean(targetCamp)}
          detail={targetCamp ?? lead.vertical}
        />
        <Gate label="Sequence-ready" ok={seq} detail={seq ? "yes" : "no"} />
        <Gate
          label="In Instantly"
          ok={loaded}
          detail={lead.instantlyCampaignName ?? (loaded ? "loaded" : "—")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          {(seq || salesReady) && (
            <MetaPanel title="Next step">
              <NextActionEditor
                nextAction={lead.nextAction}
                nextActionDue={lead.nextActionDue}
                onSave={(patch) => setLeadNextAction(lead.id, patch)}
              />
            </MetaPanel>
          )}

          <MetaPanel title="ICP score">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="font-mono text-3xl font-semibold tabular text-ink">
                  {lead.icpScore}
                </p>
                <p className="text-xs text-fg-muted">
                  Tier {lead.icpTier} · fit not intent
                </p>
              </div>
              <StatusChip
                label={lead.icpTier}
                tone={
                  lead.icpTier === "A"
                    ? "mint"
                    : lead.icpTier === "B"
                      ? "cyan"
                      : "neutral"
                }
              />
            </div>
            {(
              [
                ["Industry", lead.icp.industryFit],
                ["Size", lead.icp.sizeFit],
                ["Geo", lead.icp.geoFit],
                ["Tech", lead.icp.techFit],
                ["Budget", lead.icp.budgetSignal],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="mb-1.5">
                <div className="mb-0.5 flex justify-between text-[10px] text-fg-subtle">
                  <span>{label}</span>
                  <span className="font-mono">
                    {v}/{icpMax}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-mist">
                  <div
                    className="h-full rounded-full bg-product-mint"
                    style={{ width: `${(v / icpMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </MetaPanel>

          <MetaPanel title="Record">
            <MetaRow k="Email" v={lead.email || "—"} mono />
            <MetaRow k="Phone" v={lead.phone ?? "—"} mono />
            <MetaRow k="Website" v={lead.websiteUrl ?? "—"} />
            <MetaRow k="State" v={lead.state ?? "—"} mono />
            <MetaRow k="Source" v={lead.source} />
            <MetaRow k="Batch" v={lead.scrapeBatch ?? "—"} mono />
            <MetaRow
              k="Last touch"
              v={formatRelative(lead.lastTouch, DEMO_NOW)}
            />
            <TagList tags={lead.tags} />
          </MetaPanel>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <MetaPanel title="Activity">
            <Timeline items={timeline} onComplete={completeActivity} />
          </MetaPanel>
        </div>
      </div>
    </div>
  );
}

function Gate({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        ok
          ? "border-product-mint/30 bg-product-mint/5"
          : "border-border-soft bg-card"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-xs font-semibold ${
          ok ? "text-product-mint" : "text-fg-muted"
        }`}
      >
        {detail}
      </p>
    </div>
  );
}
