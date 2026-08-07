/**
 * Bootstrap hydrate for full-app E2E: pull live (or mock) slices into the client store.
 */

import { listAccountsService } from "./account-service.server";
import { listOpportunitiesService } from "./opportunity-service.server";
import { listLeadsService } from "./lead-service.server";
import { isLiveWire } from "./config";
import { seedActivities, seedContacts } from "../seed";
import type { Account, Activity, Contact, Lead, Opportunity } from "../types";
import { getServerSupabaseConfig } from "./config";

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
  const relatedType =
    row.opportunity_id
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
    dueAt: row.due_at ? String(row.due_at) : row.occurred_at ? String(row.occurred_at) : null,
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
  // Prefer activities table; fall back to crm_tasks
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

export async function hydrateCrmService(): Promise<HydratePayload> {
  const live = isLiveWire();

  const [leadsR, accountsR, oppsR] = await Promise.all([
    listLeadsService({
      view: "all",
      limit: 150,
      offset: 0,
    }),
    listAccountsService({ limit: 150, offset: 0, sort: "recent" }),
    listOpportunitiesService({ limit: 150, offset: 0 }),
  ]);

  let activities: Activity[] = seedActivities;
  let contacts: Contact[] = seedContacts;

  if (live && leadsR.source === "live") {
    try {
      activities = await fetchActivitiesLive();
      if (!activities.length) activities = seedActivities;
    } catch {
      activities = seedActivities;
    }
    // Contacts: pull primaries already embedded on accounts; keep seed extras minimal
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
