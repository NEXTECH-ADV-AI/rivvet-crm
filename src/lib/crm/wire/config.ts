/**
 * CRM data source config — aligned with production CRM on Vercel (`crm-rivvetai`).
 *
 * Canonical env (crm.rivvetai.com / Vercel project crm-rivvetai):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Server uses service role for gtm_leads admin reads.
 * Client never sees service role.
 *
 * Note: ops/command is a separate product (not this CRM).
 */

export type CrmDataSource = "mock" | "live";

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
} {
  // Prefer production CRM / Vercel names first
  const url = firstEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "CRM_SUPABASE_URL",
    "VITE_SUPABASE_URL",
  ).replace(/\/$/, "");

  const serviceKey = firstEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRM_SUPABASE_SERVICE_ROLE_KEY",
  );
  const anonKey = firstEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
    "CRM_SUPABASE_ANON_KEY",
  );

  const key = serviceKey || anonKey;
  const keyKind: "service_role" | "anon" | "none" = serviceKey
    ? "service_role"
    : anonKey
      ? "anon"
      : "none";

  const force = firstEnv("CRM_DATA_SOURCE").toLowerCase();
  if (force === "mock") {
    return { url: "", key: "", keyKind: "none", source: "mock" };
  }
  if (force === "live" && url && key) {
    return { url, key, keyKind, source: "live" };
  }
  if (url && key) {
    return { url, key, keyKind, source: "live" };
  }
  return { url: "", key: "", keyKind: "none", source: "mock" };
}

export function isLiveWire(): boolean {
  return getServerSupabaseConfig().source === "live";
}

export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}
