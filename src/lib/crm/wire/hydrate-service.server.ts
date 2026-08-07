/**
 * Bootstrap hydrate for full-app E2E: pull live (or mock) slices into the client store.
 *
 * Sandbox / local without service_role: proxy the LIVE sibling deploy book so the
 * Grok preview matches production pipeline (ops/command pattern — secrets stay on Vercel).
 */

import { listAccountsService } from "./account-service.server";
import { listOpportunitiesService } from "./opportunity-service.server";
import { listLeadsService } from "./lead-service.server";
import {
  getHydrateProxyUrl,
  getServerSupabaseConfig,
  isLiveWire,
  isVercelRuntime,
} from "./config";
import { seedActivities, seedContacts } from "../seed";
import type { Account, Activity, Contact, Lead, Opportunity } from "../types";

export type HydratePayload = {
  source: "mock" | "live";
  leads: Lead[];
  accounts: Account[];
  opportunities: Opportunity[];
  contacts: Contact[];
  activities: Activity[];
  message: string;
  counts: {
    leads: number;
    accounts: number;
    opportunities: number;
  };
};

function mapActivityRow(row: Record<string, unknown>): Activity {
  const id = String(row.activity_id || row.task_id || row.id || Math.random());
  const typeRaw = String(row.type || row.activity_type || "note").toLowerCase();
  const type =
    typeRaw === "call" ||
    typeRaw === "email" ||
    typeRaw === "meeting" ||
    typeRaw === "task" ||
    typeRaw === "system"
      ? typeRaw
      : "note";
  const relatedType = row.opportunity_id
    ? "opportunity"
    : row.account_id
      ? "account"
      : "lead";
  const relatedId = String(
    row.opportunity_id || row.account_id || row.gtm_lead_id || id,
  );
  return {
    id,
    type: type as Activity["type"],
    subject: String(row.title || row.subject || row.body || "Activity").slice(
      0,
      120,
    ),
    body: String(row.body || row.notes || row.description || ""),
    relatedType,
    relatedId,
    relatedName: String(row.related_name || relatedId),
    ownerId: "usr_you",
    dueAt: row.due_at
      ? String(row.due_at)
      : row.occurred_at
        ? String(row.occurred_at)
        : null,
    completedAt:
      row.status === "done" || row.status === "completed"
        ? String(row.updated_at || row.occurred_at || new Date().toISOString())
        : null,
    createdAt: String(
      row.occurred_at || row.created_at || new Date().toISOString(),
    ),
  };
}

async function fetchActivitiesLive(): Promise<Activity[]> {
  const { url, key } = getServerSupabaseConfig();
  for (const path of [
    `/activities?select=*&order=occurred_at.desc&limit=80`,
    `/crm_tasks?select=*&status=eq.open&order=due_at.asc.nullslast&limit=80`,
  ]) {
    try {
      const res = await fetch(`${url}/rest/v1${path}`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) continue;
      const rows = (await res.json()) as Record<string, unknown>[];
      if (Array.isArray(rows) && rows.length) {
        return rows.map(mapActivityRow);
      }
    } catch {
      /* try next */
    }
  }
  return [];
}

async function hydrateViaProxy(proxyBase: string): Promise<HydratePayload | null> {
  const base = proxyBase.replace(/\/$/, "");
  const res = await fetch(`${base}/api/crm/book`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as HydratePayload & { error?: string };
  if (data.error || data.source !== "live") return null;
  if (!Array.isArray(data.opportunities)) return null;
  return {
    ...data,
    source: "live",
    message: `Hydrated LIVE via ${base.replace(/^https?:\/\//, "")} · leads live · accounts live · opps live`,
    counts: data.counts ?? {
      leads: data.leads?.length ?? 0,
      accounts: data.accounts?.length ?? 0,
      opportunities: data.opportunities?.length ?? 0,
    },
  };
}

export async function hydrateCrmService(opts?: {
  /** Prevent proxy loops when serving /api/crm/book */
  allowProxy?: boolean;
}): Promise<HydratePayload> {
  const allowProxy = opts?.allowProxy !== false;

  // Local/sandbox without secrets → pull book from LIVE Vercel sibling
  if (!isLiveWire() && allowProxy) {
    const proxy = getHydrateProxyUrl();
    if (proxy) {
      try {
        const remote = await hydrateViaProxy(proxy);
        if (remote) return remote;
      } catch {
        /* fall through to mock */
      }
    }
  }

  const live = isLiveWire();

  const [leadsR, accountsR, oppsR] = await Promise.all([
    listLeadsService({
      view: "all",
      limit: 200,
      offset: 0,
    }),
    listAccountsService({ limit: 200, offset: 0, sort: "recent" }),
    listOpportunitiesService({ limit: 200, offset: 0 }),
  ]);

  let activities: Activity[] = seedActivities;
  let contacts: Contact[] = seedContacts;

  if (live && (leadsR.source === "live" || oppsR.source === "live")) {
    try {
      activities = await fetchActivitiesLive();
      if (!activities.length) activities = seedActivities;
    } catch {
      activities = seedActivities;
    }
    contacts = [];
  }

  const source =
    leadsR.source === "live" ||
    accountsR.source === "live" ||
    oppsR.source === "live"
      ? "live"
      : "mock";

  const parts = [
    `leads ${leadsR.source}`,
    `accounts ${accountsR.source}`,
    `opps ${oppsR.source}`,
  ];
  const warn = [leadsR, accountsR, oppsR]
    .map((r) => ("message" in r ? r.message : undefined))
    .filter(Boolean)
    .join(" · ");

  return {
    source,
    leads: leadsR.leads,
    accounts: accountsR.accounts,
    opportunities: oppsR.opportunities,
    contacts,
    activities,
    message: warn
      ? `${parts.join(" · ")} — ${warn}`
      : live
        ? `Hydrated LIVE · ${parts.join(" · ")}`
        : `Hydrated MOCK seed · full UI E2E without Supabase secrets`,
    counts: {
      leads: leadsR.total,
      accounts: accountsR.total,
      opportunities: oppsR.total,
    },
  };
}
