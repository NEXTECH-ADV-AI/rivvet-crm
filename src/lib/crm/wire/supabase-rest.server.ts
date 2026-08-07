/**
 * Server-only Supabase PostgREST client (no browser bundle).
 * LOCKED: never call Instantly load or contract send from here.
 */

import { getServerSupabaseConfig } from "./config";
import type { GtmLeadRow } from "./gtm-lead-map";

export class WireHttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "WireHttpError";
  }
}

function headers(prefer?: string): HeadersInit {
  const { key } = getServerSupabaseConfig();
  const h: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

function baseUrl(): string {
  const { url, source } = getServerSupabaseConfig();
  if (source !== "live" || !url) {
    throw new Error("Supabase not configured — CRM_DATA_SOURCE is mock");
  }
  return `${url}/rest/v1`;
}

export async function restGet(
  path: string,
  query: Record<string, string>,
): Promise<{ rows: GtmLeadRow[]; contentRange: string | null }> {
  const qs = new URLSearchParams(query);
  const res = await fetch(`${baseUrl()}${path}?${qs}`, {
    method: "GET",
    headers: {
      ...headers(),
      Prefer: "count=exact",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new WireHttpError(
      `GET ${path} ${res.status}: ${body.slice(0, 200)}`,
      res.status,
    );
  }
  const rows = (await res.json()) as GtmLeadRow[];
  return { rows, contentRange: res.headers.get("content-range") };
}

export async function restPatch(
  path: string,
  matchQuery: Record<string, string>,
  body: Record<string, unknown>,
): Promise<GtmLeadRow | null> {
  const qs = new URLSearchParams(matchQuery);
  const res = await fetch(`${baseUrl()}${path}?${qs}`, {
    method: "PATCH",
    headers: {
      ...headers("return=representation"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new WireHttpError(
      `PATCH ${path} ${res.status}: ${t.slice(0, 200)}`,
      res.status,
    );
  }
  const data = (await res.json()) as GtmLeadRow[];
  return data[0] ?? null;
}

/** Parse PostgREST content-range: "0-49/1234" */
export function parseTotal(contentRange: string | null): number | null {
  if (!contentRange) return null;
  const m = contentRange.match(/\/(\d+|\*)/);
  if (!m || m[1] === "*") return null;
  return Number(m[1]);
}
