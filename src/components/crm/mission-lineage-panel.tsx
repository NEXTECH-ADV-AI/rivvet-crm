import { MetaPanel } from "./meta-panel";
import { StatusChip } from "./status-chip";
import { useMissionLineage } from "@/lib/crm/wire";

const TRIAL_LABEL: Record<string, string> = {
  pending: "Trial pending",
  checkout_created: "Checkout created",
  invite_sending: "Invite sending",
  invite_sent: "Trial live",
};

/**
 * Canonical commercial-continuity lineage panel: exactly-once activity
 * timeline (source/source_ref/correlation_id), GTM mission chips, trial
 * state. Read only — absent tables or denied queries render "unavailable"
 * with a reason, never a fabricated zero.
 */
export function MissionLineagePanel({
  accountId,
  gtmLeadId,
  clientId,
  showTrial = false,
}: {
  accountId?: string | null;
  gtmLeadId?: string | null;
  clientId?: string | null;
  showTrial?: boolean;
}) {
  const q = useMissionLineage({ accountId, gtmLeadId, clientId });

  if (!accountId && !gtmLeadId) return null;

  return (
    <MetaPanel title="Mission lineage">
      {q.isLoading ? (
        <p className="text-xs text-fg-muted">Loading lineage…</p>
      ) : !q.data ? (
        <p className="text-xs text-fg-muted">
          Lineage unavailable — request failed.
        </p>
      ) : (
        <div className="space-y-4">
          {showTrial && <TrialRow trial={q.data.trial} />}
          <MissionsRow missions={q.data.missions} />
        </div>
      )}
    </MetaPanel>
  );
}

function TrialRow({
  trial,
}: {
  trial: { status: "ok"; state: string; trialEndsAt: string | null } | { status: "unavailable"; reason: string };
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
        Trial state
      </h3>
      {trial.status === "ok" ? (
        <div className="flex items-center gap-2 text-xs">
          <StatusChip label={TRIAL_LABEL[trial.state] ?? trial.state} tone="mint" />
          {trial.trialEndsAt && (
            <span className="font-mono text-[10px] text-fg-subtle">
              ends {trial.trialEndsAt.slice(0, 10)}
            </span>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-fg-subtle">Not set up yet.</p>
      )}
    </div>
  );
}

function MissionsRow({
  missions,
}: {
  missions:
    | { status: "ok"; chips: { missionId: string; touchCount: number; conversionCount: number; eventTypes: string[] }[] }
    | { status: "unavailable"; reason: string };
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
        Campaign touches
      </h3>
      {missions.status !== "ok" ? (
        <p className="text-[11px] text-fg-subtle">Not available yet.</p>
      ) : missions.chips.length === 0 ? (
        <p className="text-[11px] text-fg-subtle">No mission touches attributed.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {missions.chips.map((c) => (
            <span
              key={c.missionId}
              title={c.eventTypes.join(", ") || undefined}
              className="rounded-full border border-border-soft bg-mist px-2 py-0.5 font-mono text-[10px] text-fg-muted"
            >
              {c.missionId.slice(0, 8)} · {c.touchCount} touch
              {c.touchCount === 1 ? "" : "es"}
              {c.conversionCount > 0 ? ` · ${c.conversionCount} conv` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

