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
          <ActivitiesRow activities={q.data.activities} />
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
        <p className="text-[11px] text-fg-subtle">Unavailable — {trial.reason}</p>
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
        GTM missions
      </h3>
      {missions.status !== "ok" ? (
        <p className="text-[11px] text-fg-subtle">Unavailable — {missions.reason}</p>
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

function ActivitiesRow({
  activities,
}: {
  activities:
    | {
        status: "ok";
        items: {
          id: string;
          sourceSystem: string;
          sourceRef: string;
          correlationId: string | null;
          subject: string;
          occurredAt: string;
        }[];
        duplicates: { sourceSystem: string; sourceRef: string; count: number }[];
      }
    | { status: "unavailable"; reason: string };
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
        Canonical activity timeline
      </h3>
      {activities.status !== "ok" ? (
        <p className="text-[11px] text-fg-subtle">Unavailable — {activities.reason}</p>
      ) : (
        <>
          {activities.duplicates.length > 0 && (
            <p className="mb-2 rounded-md border border-warn/30 bg-warn/10 px-2 py-1 text-[10px] text-warn">
              Data quality: {activities.duplicates.length} duplicate source_ref
              {activities.duplicates.length === 1 ? "" : "s"} detected —{" "}
              {activities.duplicates
                .map((d) => `${d.sourceSystem}:${d.sourceRef} (${d.count}x)`)
                .join(", ")}
            </p>
          )}
          {activities.items.length === 0 ? (
            <p className="text-[11px] text-fg-subtle">No canonical activity yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {activities.items.slice(0, 20).map((a) => (
                <li
                  key={`${a.sourceSystem}-${a.sourceRef}`}
                  className="rounded-md border border-border-soft bg-mist/50 px-2.5 py-1.5"
                >
                  <p className="text-xs font-medium text-ink">{a.subject}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10px] text-fg-subtle">
                    <span>{a.sourceSystem}:{a.sourceRef}</span>
                    <span>{a.occurredAt ? a.occurredAt.slice(0, 19) : "—"}</span>
                    <span>corr:{a.correlationId ?? "—"}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
