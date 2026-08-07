/**
 * Lead list / book / patch — mock or live.
 * Instantly Load GO is NOT implemented (n8n only).
 *
 * Live credentials: same Vercel env as production CRM (`crm-rivvetai`).
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (preferred) | NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { seedLeads, leadBookSnapshot } from "../seed";
import type { Lead, LeadBookSnapshot, ListView } from "../types";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  applySequenceQuery,
  type SequenceListView,
} from "../sequence-queries";
import { filterLeads, applyLeadFilters, defaultLeadFilters } from "../filters";
import {
  getServerSupabaseConfig,
  isLiveWire,
  isVercelRuntime,
  PLATFORM_SUPABASE_URL,
} from "./config";
import { mapGtmLeadRow, type GtmLeadRow } from "./gtm-lead-map";
import { parseTotal, restPatch } from "./supabase-rest.server";
import { SEQUENCE_VERTICALS } from "../lead-model";
import type {
  BookResult,
  ListLeadsInput,
  ListLeadsResult,
  WireStatus,
} from "./types";

function mapViewToSequence(view: string): SequenceListView | "all" {
  if (
    view === "ready" ||
    view === "sequence_ready" ||
    view === "load_eligible"
  ) {
    return "load_eligible";
  }
  if (view === "enrich_backlog") return "needs_enrich";
  if (view === "unverified") return "needs_verify";
  if (
    view === "needs_enrich" ||
    view === "needs_verify" ||
    view === "in_instantly" ||
    view === "high_icp"
  ) {
    return view;
  }
  return "all";
}

export async function listLeadsService(
  input: ListLeadsInput,
): Promise<ListLeadsResult> {
  const limit = Math.min(
    Math.max(1, input.limit ?? DEFAULT_PAGE_LIMIT),
    MAX_PAGE_LIMIT,
  );
  const offset = Math.max(0, input.offset ?? 0);
  const seqView = mapViewToSequence(input.view);

  if (!isLiveWire()) {
    let rows: Lead[];
    if (seqView !== "all") {
      rows = applySequenceQuery(seedLeads, {
        view: seqView,
        vertical: (input.vertical as never) ?? "all",
        state: input.state ?? "all",
        emailVerificationStatus: (input.emailVerify as never) ?? "all",
        lifecycle: (input.lifecycle as never) ?? "all",
        limit: 10_000,
      });
    } else {
      rows = filterLeads(seedLeads, (input.view as ListView) || "all");
      rows = applyLeadFilters(rows, {
        ...defaultLeadFilters,
        query: input.query ?? "",
        vertical: (input.vertical as never) ?? "all",
        lifecycle: (input.lifecycle as never) ?? "all",
        emailVerify: (input.emailVerify as never) ?? "all",
        state: input.state ?? "all",
      });
    }
    if (input.query?.trim() && seqView !== "all") {
      const t = input.query.trim().toLowerCase();
      rows = rows.filter(
        (l) =>
          l.name.toLowerCase().includes(t) ||
          l.company.toLowerCase().includes(t) ||
          l.email.toLowerCase().includes(t) ||
          (l.state ?? "").toLowerCase().includes(t),
      );
    }
    const total = rows.length;
    return {
      source: "mock",
      leads: rows.slice(offset, offset + limit),
      total,
      limit,
      offset,
    };
  }

  const { url, key } = getServerSupabaseConfig();

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "updated_at.desc");

  if (seqView === "load_eligible" || seqView === "high_icp") {
    params.set("vertical", `in.(${SEQUENCE_VERTICALS.join(",")})`);
    params.set("email_verification_status", "eq.valid");
    params.set("instantly_campaign_id", "is.null");
    params.set(
      "status",
      "not.in.(disqualified,closed_lost,loaded_to_instantly)",
    );
  } else if (seqView === "sequence_ready") {
    params.set("vertical", `in.(${SEQUENCE_VERTICALS.join(",")})`);
    params.set("email_verification_status", "eq.valid");
  } else if (seqView === "in_instantly") {
    params.set(
      "or",
      "(instantly_campaign_id.not.is.null,status.eq.loaded_to_instantly)",
    );
  } else if (seqView === "needs_enrich") {
    params.set("or", "(status.eq.scraped,status.eq.enrich_failed)");
  } else if (seqView === "needs_verify") {
    params.set(
      "or",
      "(email_verification_status.eq.pending,email_verification_status.eq.unknown,status.eq.enriched)",
    );
  }

  if (input.vertical && input.vertical !== "all") {
    params.set("vertical", `eq.${input.vertical}`);
  }
  if (input.state && input.state !== "all") {
    params.set("state", `eq.${input.state}`);
  }
  if (input.emailVerify && input.emailVerify !== "all") {
    params.set("email_verification_status", `eq.${input.emailVerify}`);
  }
  if (input.lifecycle && input.lifecycle !== "all") {
    params.set("status", `eq.${input.lifecycle}`);
  }
  if (input.query?.trim()) {
    const t = input.query.trim().replace(/[%_,.()]/g, "");
    params.set(
      "or",
      `(business_name.ilike.*${t}*,owner_name.ilike.*${t}*,owner_email.ilike.*${t}*,general_email.ilike.*${t}*)`,
    );
  }

  const res = await fetch(`${url}/rest/v1/gtm_leads?${params}`, {
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
    throw new Error(
      `gtm_leads list failed ${res.status}: ${body.slice(0, 180)}`,
    );
  }
  const rows = (await res.json()) as GtmLeadRow[];
  const total = parseTotal(res.headers.get("content-range")) ?? rows.length;
  return {
    source: "live",
    leads: rows.map(mapGtmLeadRow),
    total,
    limit,
    offset,
  };
}

export async function getBookService(): Promise<BookResult> {
  if (!isLiveWire()) {
    return { source: "mock", book: leadBookSnapshot };
  }

  const { url, key } = getServerSupabaseConfig();

  async function count(filter: string): Promise<number> {
    const res = await fetch(
      `${url}/rest/v1/gtm_leads?select=gtm_lead_id${filter ? `&${filter}` : ""}`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      },
    );
    if (!res.ok) return 0;
    return parseTotal(res.headers.get("content-range")) ?? 0;
  }

  const total = await count("");
  const validEmail = await count("email_verification_status=eq.valid");
  const sequenceReady = await count(
    `email_verification_status=eq.valid&vertical=in.(${SEQUENCE_VERTICALS.join(",")})`,
  );
  const inInstantly = await count(
    "or=(instantly_campaign_id.not.is.null,status.eq.loaded_to_instantly)",
  );

  const book: LeadBookSnapshot = {
    ...leadBookSnapshot,
    total,
    validEmail,
    sequenceReady,
    inInstantly,
    asOf: new Date().toISOString().slice(0, 10),
    notes:
      "Live aggregates from gtm_leads (lifecycle/vertical mix partially mirrored until rollup RPC).",
  };

  return { source: "live", book };
}

export async function patchLeadNextActionService(input: {
  gtmLeadId: string;
  nextAction: string | null;
  nextActionDue: string | null;
}): Promise<{ source: "mock" | "live"; ok: boolean; message: string }> {
  if (!isLiveWire()) {
    return {
      source: "mock",
      ok: true,
      message: "Mock mode — use local store for next action",
    };
  }
  try {
    await restPatch(
      "/gtm_leads",
      { gtm_lead_id: `eq.${input.gtmLeadId}` },
      {
        next_action: input.nextAction,
        next_action_due: input.nextActionDue,
        updated_at: new Date().toISOString(),
      },
    );
    return { source: "live", ok: true, message: "Patched next_action" };
  } catch (e) {
    return {
      source: "live",
      ok: false,
      message: e instanceof Error ? e.message : "patch failed",
    };
  }
}

export function wireStatusService(): WireStatus {
  const cfg = getServerSupabaseConfig();
  const live = cfg.source === "live";
  const vercel = isVercelRuntime();
  const hasUrlEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.CRM_SUPABASE_URL,
  );
  const hasService = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.CRM_SUPABASE_SERVICE_ROLE_KEY,
  );
  const hasAnonEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.CRM_SUPABASE_ANON_KEY,
  );

  let message: string;
  if (live) {
    message = `LIVE — crm_opportunities · accounts · gtm_leads via service_role${vercel ? " on Vercel" : ""}.`;
  } else if (cfg.blockReason === "CRM_DATA_SOURCE=mock") {
    message =
      "Forced MOCK (CRM_DATA_SOURCE=mock). Remove that env to allow LIVE.";
  } else if (!hasService) {
    message = vercel
      ? "Blocked: SUPABASE_SERVICE_ROLE_KEY not on rivvet-crm — copy from crm-rivvetai (same as LINEAR_API_KEY for ops/command)."
      : "Blocked: SUPABASE_SERVICE_ROLE_KEY missing — anon cannot read crm_opportunities (RLS).";
  } else {
    message = cfg.blockReason || "Mock seed — LIVE not active.";
  }

  let supabaseHost = "";
  try {
    supabaseHost = new URL(cfg.url || PLATFORM_SUPABASE_URL).host;
  } catch {
    supabaseHost = "jgsghtfpejxbcdmolvsp.supabase.co";
  }

  return {
    source: live ? "live" : "mock",
    connected: live,
    tables: [
      "gtm_leads",
      "accounts",
      "contacts",
      "crm_opportunities",
      "activities",
    ],
    locked: [
      "Instantly Load GO (n8n)",
      "sendContract / PandaDoc",
      "Stripe checkout",
      "crm_create_contract_draft",
    ],
    message,
    blockReason: live ? null : cfg.blockReason,
    env: {
      host: vercel ? "vercel" : "local",
      hasNextPublicSupabaseUrl: hasUrlEnv || Boolean(cfg.url),
      hasServiceRoleKey: hasService,
      hasAnonKey: hasAnonEnv || Boolean(cfg.key),
      keyKind: cfg.keyKind,
      projectHint: "rivvet-crm · copy secrets from crm-rivvetai",
      supabaseHost,
    },
  };
}
