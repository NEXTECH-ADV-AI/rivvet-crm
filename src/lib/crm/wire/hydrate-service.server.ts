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
import { mapTaskRow, mapTouchRow } from "./activity-map";
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

async function fetchActivitiesLive(): Promise<Activity[]> {
  const { url, key } = getServerSupabaseConfig();
  const get = async (path: string) => {
    const res = await fetch(`${url}/rest/v1${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}`);
    return (await res.json()) as Record<string, unknown>[];
  };
  // Both, not the first non-empty one: tasks were never shown while the
  // touches table had rows.
  const [tasks, touches] = await Promise.all([
    get(
      `/crm_tasks?select=*,accounts(name),gtm_leads(business_name),crm_opportunities(opportunity_name)&status=eq.open&is_test=is.false&order=due_at.asc.nullslast&limit=80`,
    ),
    get(
      `/activities?select=activity_id,account_id,gtm_lead_id,type,direction,subject,summary,occurred_at,created_at,accounts(name)&order=occurred_at.desc&limit=80`,
    ),
  ]);
  return [...tasks.map(mapTaskRow), ...touches.map(mapTouchRow)];
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
    } catch {
      // Live deploy: show nothing rather than demo rows.
      activities = [];
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
        : `Showing seed data — connect service role for the live pipeline`,
    counts: {
      leads: leadsR.total,
      accounts: accountsR.total,
      opportunities: oppsR.total,
    },
  };
}
