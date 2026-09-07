/**
 * Canonical commercial-continuity lineage — read only.
 *
 * Surfaces, for an account or opportunity:
 *   - the exactly-once `activities` timeline (source/source_ref/correlation_id/occurred_at)
 *   - GTM mission lineage from `gtm_touches` / `gtm_conversion_events` (141 — PREPARED, NOT
 *     YET APPLIED; live queries 404 until that migration ships, and that renders "unavailable
 *     — reason", never a fabricated zero)
 *   - `trial_signups` state for the account's `client_id`
 *
 * No write path lives in this file. Mirrors the fetch/mock-fallback pattern in
 * account-service.server.ts and opportunity-service.server.ts.
 */

import { seedActivities } from "../seed";
import { getServerSupabaseConfig, isLiveWire } from "./config";
import {
  classifyLineageFetchError,
  dedupeCanonicalActivities,
  deriveMissionChips,
  mapCanonicalActivityRow,
  mapConversionEventRow,
  mapMissionTouchRow,
  type CanonicalActivitiesResult,
  type CanonicalActivity,
  type MissionLineageResult,
  type TrialState,
  type TrialStateValue,
  type UnavailableResult,
} from "./mission-lineage-map";

export type LineageInput = {
  accountId?: string | null;
  gtmLeadId?: string | null;
  clientId?: string | null;
};

export type LineageServiceResult = {
  source: "mock" | "live";
  activities: CanonicalActivitiesResult | UnavailableResult;
  missions: MissionLineageResult | UnavailableResult;
  trial: TrialState;
};

const ACTIVITIES_SELECT =
  "activity_id,account_id,contact_id,gtm_lead_id,type,channel,direction,subject,summary,payload,occurred_at,source,source_ref";

const TOUCHES_SELECT =
  "touch_id,mission_id,account_id,gtm_lead_id,channel,status,campaign_id,correlation_id,occurred_at";

const EVENTS_SELECT =
  "event_id,mission_id,account_id,gtm_lead_id,event_type,correlation_id,occurred_at";

const TRIAL_SELECT = "lead_session_id,state,trial_ends_at,client_id,created_at";

function scopeFilter(input: LineageInput): string | null {
  if (input.accountId) return `account_id=eq.${encodeURIComponent(input.accountId)}`;
  if (input.gtmLeadId) return `gtm_lead_id=eq.${encodeURIComponent(input.gtmLeadId)}`;
  return null;
}

async function fetchCanonicalActivitiesLive(
  input: LineageInput,
): Promise<CanonicalActivitiesResult | UnavailableResult> {
  const filter = scopeFilter(input);
  if (!filter) {
    return {
      status: "unavailable",
      reason: "no account_id or gtm_lead_id to scope the activity timeline",
    };
  }
  const { url, key } = getServerSupabaseConfig();
  try {
    const res = await fetch(
      `${url}/rest/v1/activities?select=${encodeURIComponent(ACTIVITIES_SELECT)}&${filter}&order=occurred_at.desc&limit=200`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "unavailable", reason: classifyLineageFetchError(res.status, body) };
    }
    const rows = (await res.json()) as Record<string, unknown>[];
    const mapped = rows.map(mapCanonicalActivityRow);
    const { items, duplicates } = dedupeCanonicalActivities(mapped);
    return { status: "ok", items, duplicates };
  } catch (e) {
    return {
      status: "unavailable",
      reason: e instanceof Error ? e.message : "activities fetch failed",
    };
  }
}

function mockCanonicalActivities(input: LineageInput): CanonicalActivitiesResult {
  const rows = seedActivities.filter(
    (a) =>
      (input.accountId &&
        ((a.relatedType === "account" && a.relatedId === input.accountId) ||
          (a.secondaryRelatedType === "account" &&
            a.secondaryRelatedId === input.accountId))) ||
      (input.gtmLeadId && a.relatedType === "lead" && a.relatedId === input.gtmLeadId),
  );
  const mapped: CanonicalActivity[] = rows.map((a) => ({
    id: a.id,
    sourceSystem: "mock",
    sourceRef: a.id,
    correlationId: null,
    type: a.type,
    subject: a.subject,
    summary: a.body || null,
    occurredAt: a.createdAt,
    accountId:
      a.relatedType === "account"
        ? a.relatedId
        : a.secondaryRelatedType === "account"
          ? (a.secondaryRelatedId ?? null)
          : null,
    contactId: null,
    gtmLeadId: a.relatedType === "lead" ? a.relatedId : null,
  }));
  const { items, duplicates } = dedupeCanonicalActivities(mapped);
  return { status: "ok", items, duplicates };
}

async function fetchMissionLineageLive(
  input: LineageInput,
): Promise<MissionLineageResult | UnavailableResult> {
  const filter = scopeFilter(input);
  if (!filter) {
    return {
      status: "unavailable",
      reason: "no account_id or gtm_lead_id to scope mission lineage",
    };
  }
  const { url, key } = getServerSupabaseConfig();
  try {
    const [touchesRes, eventsRes] = await Promise.all([
      fetch(
        `${url}/rest/v1/gtm_touches?select=${encodeURIComponent(TOUCHES_SELECT)}&${filter}&order=occurred_at.desc&limit=100`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Accept: "application/json",
          },
        },
      ),
      fetch(
        `${url}/rest/v1/gtm_conversion_events?select=${encodeURIComponent(EVENTS_SELECT)}&${filter}&order=occurred_at.desc&limit=100`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Accept: "application/json",
          },
        },
      ),
    ]);
    if (!touchesRes.ok || !eventsRes.ok) {
      const failing = touchesRes.ok ? eventsRes : touchesRes;
      const body = await failing.text().catch(() => "");
      return { status: "unavailable", reason: classifyLineageFetchError(failing.status, body) };
    }
    const touchRows = (await touchesRes.json()) as Record<string, unknown>[];
    const eventRows = (await eventsRes.json()) as Record<string, unknown>[];
    const touches = touchRows.map(mapMissionTouchRow);
    const events = eventRows.map(mapConversionEventRow);
    return { status: "ok", chips: deriveMissionChips(touches, events) };
  } catch (e) {
    return {
      status: "unavailable",
      reason: e instanceof Error ? e.message : "mission lineage fetch failed",
    };
  }
}

async function fetchTrialStateLive(clientId: string | null | undefined): Promise<TrialState> {
  if (!clientId) {
    return {
      status: "unavailable",
      reason: "account has no client_id — trial linkage requires a provisioned client",
    };
  }
  const { url, key } = getServerSupabaseConfig();
  try {
    const res = await fetch(
      `${url}/rest/v1/trial_signups?select=${encodeURIComponent(TRIAL_SELECT)}&client_id=eq.${encodeURIComponent(clientId)}&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "unavailable", reason: classifyLineageFetchError(res.status, body) };
    }
    const rows = (await res.json()) as Record<string, unknown>[];
    const row = rows[0];
    if (!row) {
      return { status: "unavailable", reason: "no trial_signups row for this client" };
    }
    const validStates: TrialStateValue[] = [
      "pending",
      "checkout_created",
      "invite_sending",
      "invite_sent",
    ];
    const rawState = String(row.state ?? "pending");
    const state = (validStates as string[]).includes(rawState)
      ? (rawState as TrialStateValue)
      : "pending";
    return {
      status: "ok",
      state,
      trialEndsAt: row.trial_ends_at != null ? String(row.trial_ends_at) : null,
      clientId: row.client_id != null ? String(row.client_id) : null,
    };
  } catch (e) {
    return {
      status: "unavailable",
      reason: e instanceof Error ? e.message : "trial fetch failed",
    };
  }
}

export async function getMissionLineageService(
  input: LineageInput,
): Promise<LineageServiceResult> {
  if (!isLiveWire()) {
    return {
      source: "mock",
      activities: mockCanonicalActivities(input),
      missions: {
        status: "unavailable",
        reason: "mock mode has no mission fixtures — set Supabase env for LIVE",
      },
      trial: {
        status: "unavailable",
        reason: "mock mode has no trial fixtures — set Supabase env for LIVE",
      },
    };
  }

  const [activities, missions, trial] = await Promise.all([
    fetchCanonicalActivitiesLive(input),
    fetchMissionLineageLive(input),
    fetchTrialStateLive(input.clientId),
  ]);

  return { source: "live", activities, missions, trial };
}
