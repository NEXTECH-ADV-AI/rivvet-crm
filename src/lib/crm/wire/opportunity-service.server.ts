/**
 * crm_opportunities list / detail / stage patch — mock or live.
 * Sacred: no PandaDoc / Stripe / sendContract.
 */

import { seedOpportunities } from "../seed";
import type { LostReason, OppStage, Opportunity } from "../types";
import { filterOpps } from "../filters";
import { getServerSupabaseConfig, isLiveWire } from "./config";
import { mapOpportunityRow, mapOppStage, type ProdOppRow } from "./opportunity-map";
import { parseTotal } from "./supabase-rest.server";

const LIST_SELECT =
  "opportunity_id,source_gtm_lead_id,legacy_deal_id,account_id,primary_contact_id,contact_email,opportunity_name,stage,amount,expected_close_date,assigned_rep_email,sent_by_email,created_at,updated_at,is_test,test_reason,accounts(name)";

export type ListOppsInput = {
  view?: string;
  query?: string;
  stage?: string;
  owner?: string;
  limit?: number;
  offset?: number;
};

export type ListOppsResult = {
  source: "mock" | "live";
  opportunities: Opportunity[];
  total: number;
  limit: number;
  offset: number;
  message?: string;
};

export async function listOpportunitiesService(
  input: ListOppsInput = {},
): Promise<ListOppsResult> {
  const limit = Math.min(Math.max(1, input.limit ?? 100), 200);
  const offset = Math.max(0, input.offset ?? 0);

  if (!isLiveWire()) {
    let rows = [...seedOpportunities];
    if (input.view) rows = filterOpps(rows, input.view as never);
    if (input.stage && input.stage !== "all") {
      rows = rows.filter((o) => o.stage === input.stage);
    }
    if (input.query?.trim()) {
      const q = input.query.trim().toLowerCase();
      rows = rows.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.accountName.toLowerCase().includes(q),
      );
    }
    return {
      source: "mock",
      opportunities: rows.slice(offset, offset + limit),
      total: rows.length,
      limit,
      offset,
    };
  }

  const { url, key } = getServerSupabaseConfig();
  const params = new URLSearchParams();
  params.set("select", LIST_SELECT);
  params.set("order", "updated_at.desc,opportunity_id.asc");
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("is_test", "not.is.true");

  if (input.query?.trim()) {
    const t = input.query.trim().replace(/[%_,.()]/g, "");
    params.set(
      "or",
      `(opportunity_name.ilike.*${t}*,contact_email.ilike.*${t}*)`,
    );
  }
  if (input.stage && input.stage !== "all") {
    params.set("stage", `eq.${input.stage}`);
  }
  if (input.owner && input.owner !== "all") {
    params.set("assigned_rep_email", `ilike.*${input.owner}*`);
  }

  try {
    const res = await fetch(`${url}/rest/v1/crm_opportunities?${params}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        Prefer: "count=exact",
        Range: `${offset}-${offset + limit - 1}`,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`crm_opportunities ${res.status}: ${body.slice(0, 160)}`);
    }
    const rows = (await res.json()) as ProdOppRow[];
    const total = parseTotal(res.headers.get("content-range")) ?? rows.length;
    return {
      source: "live",
      opportunities: rows.map(mapOpportunityRow),
      total,
      limit,
      offset,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "opps fetch failed";
    let rows = [...seedOpportunities];
    if (input.view) rows = filterOpps(rows, input.view as never);
    return {
      source: "mock",
      opportunities: rows.slice(offset, offset + limit),
      total: rows.length,
      limit,
      offset,
      message: `LIVE failed (${msg}) — mock pipeline.`,
    };
  }
}

export async function getOpportunityService(
  opportunityId: string,
): Promise<{ source: "mock" | "live"; opportunity: Opportunity | null; message?: string }> {
  if (!isLiveWire()) {
    return {
      source: "mock",
      opportunity:
        seedOpportunities.find((o) => o.id === opportunityId) ?? null,
    };
  }
  const { url, key } = getServerSupabaseConfig();
  try {
    const res = await fetch(
      `${url}/rest/v1/crm_opportunities?select=${encodeURIComponent(LIST_SELECT)}&opportunity_id=eq.${encodeURIComponent(opportunityId)}&is_test=not.is.true&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) throw new Error(`opp ${res.status}`);
    const rows = (await res.json()) as ProdOppRow[];
    return {
      source: "live",
      opportunity: rows[0] ? mapOpportunityRow(rows[0]) : null,
    };
  } catch (e) {
    return {
      source: "mock",
      opportunity:
        seedOpportunities.find((o) => o.id === opportunityId) ?? null,
      message: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

export async function patchOpportunityStageService(input: {
  opportunityId: string;
  stage: OppStage;
  lostReason?: LostReason | null;
}): Promise<{ source: "mock" | "live"; ok: boolean; message: string }> {
  if (!isLiveWire()) {
    return {
      source: "mock",
      ok: true,
      message: "Mock — use local store moveOppStage",
    };
  }
  const { url, key } = getServerSupabaseConfig();
  const body: Record<string, unknown> = {
    stage: input.stage,
    updated_at: new Date().toISOString(),
  };
  if (input.stage === "closed_lost" && input.lostReason) {
    body.lost_reason = input.lostReason;
  }
  try {
    const res = await fetch(
      `${url}/rest/v1/crm_opportunities?opportunity_id=eq.${encodeURIComponent(input.opportunityId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return {
        source: "live",
        ok: false,
        message: `Stage patch ${res.status}: ${t.slice(0, 120)}`,
      };
    }
    return { source: "live", ok: true, message: "Stage updated" };
  } catch (e) {
    return {
      source: "live",
      ok: false,
      message: e instanceof Error ? e.message : "patch failed",
    };
  }
}

export { mapOppStage };
