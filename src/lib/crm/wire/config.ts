/**
 * CRM data source config — same Supabase as production CRM (crm.rivvetai.com).
 *
 * LIVE requires SUPABASE_SERVICE_ROLE_KEY (anon cannot read crm_opportunities /
 * accounts — table grants + RLS). Same pattern as ops/command: secrets live on
 * the Vercel project, never in git.
 *
 * Public URL + anon are known platform defaults (safe in browser / NEXT_PUBLIC).
 */

export type CrmDataSource = "mock" | "live";

/** Production platform Supabase (CC-V3.1) — public project ref */
export const PLATFORM_SUPABASE_URL =
  "https://jgsghtfpejxbcdmolvsp.supabase.co";

/** Anon key is browser-safe (shipped in prod CRM client). Not sufficient for CRM tables. */
export const PLATFORM_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnc2dodGZwZWp4YmNkbW9sdnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDQ3MTcsImV4cCI6MjA4ODgyMDcxN30.3mx6z4rIYkuH9T-hkUZLpWpMDxJYyllsTxLsAispGwk";

function firstEnv(...keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export function getServerSupabaseConfig(): {
  url: string;
  key: string;
  keyKind: "service_role" | "anon" | "none";
  source: CrmDataSource;
  /** Why we're not LIVE (for Settings / banner) */
  blockReason: string | null;
} {
  const force = firstEnv("CRM_DATA_SOURCE").toLowerCase();

  const url = (
    firstEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_URL",
      "CRM_SUPABASE_URL",
      "VITE_SUPABASE_URL",
    ) || PLATFORM_SUPABASE_URL
  ).replace(/\/$/, "");

  const serviceKey = firstEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRM_SUPABASE_SERVICE_ROLE_KEY",
  );
  const anonKey =
    firstEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY",
      "CRM_SUPABASE_ANON_KEY",
    ) || PLATFORM_SUPABASE_ANON_KEY;

  if (force === "mock") {
    return {
      url: "",
      key: "",
      keyKind: "none",
      source: "mock",
      blockReason: "CRM_DATA_SOURCE=mock",
    };
  }

  // LIVE only with service role — anon gets 401/empty on crm_opportunities
  if (serviceKey && url) {
    return {
      url,
      key: serviceKey,
      keyKind: "service_role",
      source: "live",
      blockReason: null,
    };
  }

  if (force === "live") {
    return {
      url: "",
      key: "",
      keyKind: "none",
      source: "mock",
      blockReason:
        "CRM_DATA_SOURCE=live but SUPABASE_SERVICE_ROLE_KEY missing on this project",
    };
  }

  return {
    url,
    key: anonKey,
    keyKind: anonKey ? "anon" : "none",
    source: "mock",
    blockReason:
      "SUPABASE_SERVICE_ROLE_KEY not set on rivvet-crm (copy from crm-rivvetai — same as ops/command LINEAR_API_KEY)",
  };
}

export function isLiveWire(): boolean {
  return getServerSupabaseConfig().source === "live";
}

export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}
