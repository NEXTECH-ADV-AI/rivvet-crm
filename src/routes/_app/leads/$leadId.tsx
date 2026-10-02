import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { RecordHeader } from "@/components/crm/record-header";
import { Timeline } from "@/components/crm/timeline";
import { NextActionEditor } from "@/components/crm/next-action-editor";
import { MetaPanel, MetaRow, TagList } from "@/components/crm/meta-panel";
import { StatusChip } from "@/components/crm/status-chip";
import { CallRow } from "@/components/crm/call-queue";
import { CreateOpportunityButton } from "@/components/crm/create-opportunity";
import { useCompleteTask, useLead, useLogTouch, useNextAction, useRecordActivities } from "@/lib/crm/wire";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW } from "@/lib/crm/seed";
import { activitiesForEntity } from "@/lib/crm/filters";
import {
  formatMoney,
  formatRelative,
  leadPriority, ENRICH_LABEL, EMAIL_LABEL, SOURCE_LABEL, plain } from "@/lib/crm/priority";
import {
  LIFECYCLE_LABEL,
  VERTICAL_LABEL,
  campaignForVertical,
  isInInstantly,
  isSequenceReady,
} from "@/lib/crm/lead-model";

export const Route = createFileRoute("/_app/leads/$leadId")({
  component: LeadDetail,
});

function LeadDetail() {
  const { leadId } = Route.useParams();
  const leads = useCrmStore((s) => s.leads);
  const activities = useCrmStore((s) => s.activities);
  const opportunities = useCrmStore((s) => s.opportunities);
  const completeActivity = useCrmStore((s) => s.completeActivity);

  // A lead a list already showed opens at once; a pasted link loads it by id (RIV-1542).
  const stored = useMemo(() => leads.find((l) => l.id === leadId), [leads, leadId]);
  const leadQ = useLead(leadId, !stored);
  const lead = stored ?? leadQ.data?.lead ?? null;
  const ref = { gtmLeadId: lead?.gtmLeadId };
  const historyQ = useRecordActivities(ref, leadId);
  const nextQ = useNextAction(ref);
  const completeTask = useCompleteTask();
  const logTouch = useLogTouch();
  const timeline = useMemo(
    () => historyQ.data?.activities ?? (lead ? activitiesForEntity(activities, "lead", lead.id) : []),
    [historyQ.data, activities, lead],
  );

  if (!lead) {
    const loading = leadQ.isLoading;
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-semibold text-ink">
          {loading ? "Loading lead…" : leadQ.isError ? "Couldn't load this lead" : "Lead not found"}
        </h1>
        {!loading && (
          <Link to="/leads" className="mt-4 inline-block text-sm font-semibold text-product-mint hover:underline">
            Go to Leads
          </Link>
        )}
      </div>
    );
  }
  const leadOpp = lead.gtmLeadId ? opportunities.find((o) => o.gtmLeadId === lead.gtmLeadId) : undefined;
  const p = leadPriority(lead, DEMO_NOW);
  const seq = isSequenceReady(lead);
  const loaded = isInInstantly(lead);
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
        nextAction={nextQ.data?.nextAction?.title ?? null}
        lastTouch={lead.lastTouch}
        amount={lead.amountHint ? formatMoney(lead.amountHint) : null}
        priority={p.priority}
        reasons={p.reasons}
        actions={
          <>
          {lead.gtmLeadId && <CreateOpportunityButton record={{ gtmLeadId: lead.gtmLeadId }} existingId={leadOpp?.id} />}
          {seq && !loaded ? (
            <span className="rounded-md border border-product-mint/30 bg-product-mint/10 px-3 py-2 text-xs font-semibold text-product-mint">
              Ready for email outreach
              {targetCamp ? ` · ${targetCamp}` : ""}
            </span>
          ) : loaded ? (
            <button
              type="button"
              disabled={!lead.gtmLeadId || logTouch.isPending || logTouch.isSuccess}
              onClick={() => lead.gtmLeadId && logTouch.mutate({ gtmLeadId: lead.gtmLeadId, type: "email" })}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:bg-deep-ink active:scale-[0.98] disabled:opacity-50"
            >
              <Mail className="size-3.5" />
              {logTouch.isSuccess ? "Email logged" : logTouch.isError ? "Couldn't log. Retry" : "Log an email I sent"}
            </button>
          ) : (
            <span className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">
              Not ready for email yet
            </span>
          )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Gate
          label="Details found"
          ok={
            lead.enrichmentStatus !== "none" &&
            lead.enrichmentStatus !== "failed"
          }
          detail={ENRICH_LABEL[lead.enrichmentStatus] ?? plain(lead.enrichmentStatus)}
        />
        <Gate
          label="Valid email"
          ok={lead.emailVerificationStatus === "valid"}
          detail={EMAIL_LABEL[lead.emailVerificationStatus] ?? plain(lead.emailVerificationStatus)}
        />
        <Gate
          label="Trade has a campaign"
          ok={Boolean(targetCamp)}
          detail={targetCamp ?? "None for this trade yet"}
        />
        <Gate label="Ready for email" ok={seq} detail={seq ? "Yes" : "No"} />
        <Gate
          label="In a campaign"
          ok={loaded}
          detail={loaded ? "Yes" : "No"}
        />
      </div>

      {lead.phone && lead.gtmLeadId && (
        <MetaPanel title="Log a call">
          <ul className="-mx-4 -mb-4">
            <CallRow lead={lead} />
          </ul>
        </MetaPanel>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          {lead.gtmLeadId && (
            <MetaPanel title="Next step">
              <NextActionEditor record={{ gtmLeadId: lead.gtmLeadId }} />
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
            <MetaRow k="Found via" v={SOURCE_LABEL[lead.source] ?? plain(lead.source)} />
            <MetaRow
              k="Last touch"
              v={formatRelative(lead.lastTouch, DEMO_NOW)}
            />
            <TagList tags={lead.tags.filter((t) => !t.includes("_")).map(plain)} />
          </MetaPanel>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <MetaPanel title="Activity">
            {historyQ.isError && <p className="mb-2 text-xs text-danger">Couldn't load saved history. Showing what this page has.</p>}
            <Timeline
              items={timeline}
              // Saved tasks complete on the server; anything else is page-only.
              onComplete={(id) => (historyQ.data ? completeTask.mutate(id) : completeActivity(id))}
            />
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
