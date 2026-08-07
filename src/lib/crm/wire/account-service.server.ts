/**
 * Accounts list / detail / contacts — mock or live Supabase `accounts`.
 * Mirrors production account-queries (exclude is_test).
 */

import { seedAccounts, seedContacts } from "../seed";
import type { Account, Contact } from "../types";
import { filterAccounts } from "../filters";
import { getServerSupabaseConfig, isLiveWire } from "./config";
import {
  mapAccountRow,
  mapContactRow,
  type ProdAccountRow,
  type ProdContactRow,
} from "./account-map";
import { parseTotal } from "./supabase-rest.server";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_OFFSET = 1_000;

const LIST_SELECT =
  "account_id,name,domain,vertical,phone,city,state,lifecycle_stage,owner_email,source,qualification_score,primary_contact_id,primary_contact:contacts!accounts_primary_contact_fk(name,email,phone),client_id,updated_at,created_at,is_test";

export type ListAccountsInput = {
  view?: string;
  query?: string;
  vertical?: string;
  state?: string;
  lifecycle?: string;
  sort?: "recent" | "name" | "score";
  limit?: number;
  offset?: number;
};

export type ListAccountsResult = {
  source: "mock" | "live";
  accounts: Account[];
  total: number;
  limit: number;
  offset: number;
  message?: string;
};

export type GetAccountResult = {
  source: "mock" | "live";
  account: Account | null;
  contacts: Contact[];
  message?: string;
};

export type AccountsFunnel = {
  source: "mock" | "live";
  total: number;
  customers: number;
  opportunities: number;
  engaged: number;
  prospects: number;
  churned: number;
};

function clampLimit(n?: number) {
  return Math.min(Math.max(1, n ?? DEFAULT_LIMIT), MAX_LIMIT);
}
function clampOffset(n?: number) {
  return Math.min(Math.max(0, n ?? 0), MAX_OFFSET);
}

const LIFECYCLE_FILTERS = new Set([
  "prospect",
  "engaged",
  "opportunity",
  "customer",
  "churned",
]);

function mockFilter(
  items: Account[],
  input: ListAccountsInput,
): Account[] {
  let rows = [...items];
  const life = input.lifecycle?.toLowerCase();
  if (life && LIFECYCLE_FILTERS.has(life)) {
    rows = rows.filter(
      (a) =>
        (a.lifecycleStage ?? a.status) === life ||
        (life === "customer" && a.status === "customer") ||
        (life === "prospect" && a.status === "prospect") ||
        (life === "churned" && a.status === "churned"),
    );
  }
  if (input.vertical && input.vertical !== "all") {
    const v = input.vertical.toLowerCase();
    rows = rows.filter(
      (a) =>
        a.vertical === v ||
        a.industry.toLowerCase().includes(v),
    );
  }
  if (input.state && input.state !== "all") {
    const st = input.state.toUpperCase();
    rows = rows.filter(
      (a) =>
        (a.state ?? "").toUpperCase() === st ||
        a.region.toUpperCase().includes(st),
    );
  }
  if (input.query?.trim()) {
    const q = input.query.trim().toLowerCase();
    rows = rows.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.domain ?? "").toLowerCase().includes(q) ||
        a.industry.toLowerCase().includes(q),
    );
  }
  // view tabs from seed filter helper
  if (input.view && input.view !== "all") {
    rows = filterAccounts(rows, input.view as never);
  }
  const sort = input.sort ?? "recent";
  if (sort === "name") {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "score") {
    rows.sort(
      (a, b) =>
        (b.qualificationScore ?? 0) - (a.qualificationScore ?? 0),
    );
  } else {
    rows.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }
  return rows;
}

export async function listAccountsService(
  input: ListAccountsInput = {},
): Promise<ListAccountsResult> {
  const limit = clampLimit(input.limit);
  const offset = clampOffset(input.offset);

  if (!isLiveWire()) {
    // Enrich seed with lifecycleStage for UI
    const enriched = seedAccounts.map((a) => ({
      ...a,
      lifecycleStage:
        a.lifecycleStage ??
        (a.status === "customer" || a.status === "active"
          ? a.status === "customer"
            ? ("customer" as const)
            : ("engaged" as const)
          : a.status === "churned"
            ? ("churned" as const)
            : a.status === "at_risk"
              ? ("churned" as const)
              : ("prospect" as const)),
    }));
    const filtered = mockFilter(enriched, input);
    return {
      source: "mock",
      accounts: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
      message: "Mock seed accounts — set Supabase env for LIVE.",
    };
  }

  const { url, key } = getServerSupabaseConfig();
  const params = new URLSearchParams();
  params.set("select", LIST_SELECT);
  const sort = input.sort ?? "recent";
  params.set(
    "order",
    sort === "score"
      ? "qualification_score.desc.nullslast,updated_at.desc,account_id.asc"
      : sort === "name"
        ? "name.asc,account_id.asc"
        : "updated_at.desc,account_id.asc",
  );
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("is_test", "not.is.true");

  if (input.query?.trim()) {
    const t = input.query.trim().replace(/[%_,.()]/g, "");
    params.set("name", `ilike.*${t}*`);
  }
  if (input.vertical && input.vertical !== "all") {
    params.set("vertical", `eq.${input.vertical.toLowerCase()}`);
  }
  if (input.state && input.state !== "all") {
    params.set("state", `eq.${input.state.toUpperCase()}`);
  }
  if (input.lifecycle && LIFECYCLE_FILTERS.has(input.lifecycle.toLowerCase())) {
    params.set("lifecycle_stage", `eq.${input.lifecycle.toLowerCase()}`);
  }

  try {
    const res = await fetch(`${url}/rest/v1/accounts?${params}`, {
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
      throw new Error(`accounts ${res.status}: ${body.slice(0, 180)}`);
    }
    const rows = (await res.json()) as ProdAccountRow[];
    const total = parseTotal(res.headers.get("content-range")) ?? rows.length;
    return {
      source: "live",
      accounts: rows.map(mapAccountRow),
      total,
      limit,
      offset,
    };
  } catch (e) {
    // Fallback mock if table missing / RLS
    const msg = e instanceof Error ? e.message : "accounts fetch failed";
    const filtered = mockFilter(seedAccounts, input);
    return {
      source: "mock",
      accounts: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
      message: `LIVE failed (${msg}) — showing mock.`,
    };
  }
}

export async function getAccountService(
  accountId: string,
): Promise<GetAccountResult> {
  if (!isLiveWire()) {
    const account = seedAccounts.find((a) => a.id === accountId) ?? null;
    const contacts = seedContacts.filter((c) => c.accountId === accountId);
    return { source: "mock", account, contacts };
  }

  const { url, key } = getServerSupabaseConfig();
  const id = accountId.trim();

  try {
    const accRes = await fetch(
      `${url}/rest/v1/accounts?select=${encodeURIComponent(LIST_SELECT)}&account_id=eq.${encodeURIComponent(id)}&is_test=not.is.true&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      },
    );
    if (!accRes.ok) {
      throw new Error(`account ${accRes.status}`);
    }
    const accRows = (await accRes.json()) as ProdAccountRow[];
    if (!accRows[0]) {
      return { source: "live", account: null, contacts: [] };
    }
    const account = mapAccountRow(accRows[0]);

    const cRes = await fetch(
      `${url}/rest/v1/contacts?select=contact_id,account_id,name,title,email,phone,is_primary,created_at&account_id=eq.${encodeURIComponent(id)}&order=is_primary.desc,created_at.asc&limit=50`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      },
    );
    let contacts: Contact[] = [];
    if (cRes.ok) {
      const cRows = (await cRes.json()) as ProdContactRow[];
      contacts = cRows.map(mapContactRow);
    }

    return { source: "live", account, contacts };
  } catch (e) {
    const account = seedAccounts.find((a) => a.id === accountId) ?? null;
    const contacts = seedContacts.filter((c) => c.accountId === accountId);
    return {
      source: "mock",
      account,
      contacts,
      message: e instanceof Error ? e.message : "account fetch failed",
    };
  }
}

export async function getAccountsFunnelService(): Promise<AccountsFunnel> {
  if (!isLiveWire()) {
    const a = seedAccounts;
    return {
      source: "mock",
      total: a.length,
      customers: a.filter(
        (x) => x.status === "customer" || x.status === "active",
      ).length,
      opportunities: a.filter((x) => x.openOpps > 0).length,
      engaged: a.filter((x) => x.status === "active").length,
      prospects: a.filter((x) => x.status === "prospect").length,
      churned: a.filter(
        (x) => x.status === "churned" || x.status === "at_risk",
      ).length,
    };
  }

  // Prefer exact RPC if present; else approximate via counts
  const { url, key } = getServerSupabaseConfig();
  async function count(filter: string): Promise<number> {
    const res = await fetch(
      `${url}/rest/v1/accounts?select=account_id&is_test=not.is.true${filter ? `&${filter}` : ""}`,
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

  try {
    // Try RPC first
    const rpc = await fetch(`${url}/rest/v1/rpc/crm_account_funnel`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
    });
    if (rpc.ok) {
      const data = (await rpc.json()) as Record<string, unknown>;
      // shape may vary
      return {
        source: "live",
        total: num(data.total ?? data.all),
        customers: num(data.customers),
        opportunities: num(data.opportunities),
        engaged: num(data.engaged),
        prospects: num(data.prospects),
        churned: num(data.churned),
      };
    }
  } catch {
    /* fall through */
  }

  const [
    total,
    customers,
    opportunities,
    engaged,
    prospects,
    churned,
  ] = await Promise.all([
    count(""),
    count("lifecycle_stage=eq.customer"),
    count("lifecycle_stage=eq.opportunity"),
    count("lifecycle_stage=eq.engaged"),
    count("lifecycle_stage=eq.prospect"),
    count("lifecycle_stage=eq.churned"),
  ]);

  return {
    source: "live",
    total,
    customers,
    opportunities,
    engaged,
    prospects,
    churned,
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
