/**
 * Map production `accounts` / `contacts` rows → sandbox Account / Contact.
 * @see packages/ops-hub/lib/crm/account-queries.ts
 */

import type {
  Account,
  AccountHealth,
  AccountLifecycle,
  AccountStatus,
  Contact,
  OwnerId,
  Vertical,
} from "../types";

export type ProdAccountRow = Record<string, unknown>;
export type ProdContactRow = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

const LIFECYCLES = new Set([
  "prospect",
  "engaged",
  "opportunity",
  "customer",
  "churned",
]);

export function asAccountLifecycle(v: unknown): AccountLifecycle {
  const s = str(v, "prospect").toLowerCase();
  if (LIFECYCLES.has(s)) return s as AccountLifecycle;
  return "prospect";
}

/** Map prod lifecycle → UI status used by chips / filters */
export function lifecycleToStatus(life: AccountLifecycle): AccountStatus {
  switch (life) {
    case "customer":
      return "customer";
    case "churned":
      return "churned";
    case "engaged":
    case "opportunity":
      return "active";
    default:
      return "prospect";
  }
}

function lifecycleToHealth(life: AccountLifecycle): AccountHealth {
  if (life === "churned") return "risk";
  if (life === "customer") return "healthy";
  if (life === "opportunity" || life === "engaged") return "watch";
  return "watch";
}

function asVertical(v: unknown): Vertical {
  const s = str(v, "other").toLowerCase().replace(/\s+/g, "_");
  const known: Vertical[] = [
    "hvac",
    "plumbing",
    "pool",
    "cleaning",
    "landscaping",
    "pest",
    "electrical",
    "roofing",
    "dental",
    "fleet",
    "logistics",
    "field_service",
    "commerce",
    "other",
  ];
  return (known.includes(s as Vertical) ? s : "other") as Vertical;
}

function ownerFromEmail(email: string | null): OwnerId {
  if (!email) return "unassigned";
  const e = email.toLowerCase();
  if (e.includes("maya")) return "usr_maya";
  if (e.includes("jordan")) return "usr_jordan";
  if (e.includes("brayden") || e.includes("you") || e.includes("rivvet")) {
    return "usr_you";
  }
  return "unassigned";
}

function primaryContact(
  row: ProdAccountRow,
): { name?: string; email?: string; phone?: string } | null {
  const value = Array.isArray(row.primary_contact)
    ? row.primary_contact[0]
    : row.primary_contact;
  if (value && typeof value === "object") {
    return value as { name?: string; email?: string; phone?: string };
  }
  return null;
}

export function mapAccountRow(row: ProdAccountRow): Account {
  const life = asAccountLifecycle(row.lifecycle_stage ?? row.lifecycle);
  const status = lifecycleToStatus(life);
  const id = str(row.account_id || row.id);
  const city = row.city ? str(row.city) : null;
  const state = row.state ? str(row.state) : null;
  const region = [city, state].filter(Boolean).join(", ") || str(row.region, "—");
  const vertical = asVertical(row.vertical);
  const ownerEmail = row.owner_email ? str(row.owner_email) : null;
  const contact = primaryContact(row);
  const updated = str(
    row.updated_at || row.created_at,
    new Date().toISOString(),
  );

  return {
    id,
    accountId: id,
    name: str(row.name, "Unnamed account"),
    domain: row.domain ? str(row.domain) : null,
    industry: str(row.vertical || row.industry, "—").replace(/_/g, " "),
    vertical,
    status,
    lifecycleStage: life,
    ownerId: ownerFromEmail(ownerEmail),
    ownerEmail,
    arr: num(row.arr ?? row.mrr, 0),
    billingEmail: row.billing_email ? str(row.billing_email) : null,
    nextAction: row.next_action ? str(row.next_action) : null,
    nextActionDue: row.next_action_due ? str(row.next_action_due) : null,
    lastTouch: updated,
    health: lifecycleToHealth(life),
    openOpps: num(row.open_opps, 0),
    createdAt: str(row.created_at, updated),
    updatedAt: updated,
    employeeBand: row.employee_band ? str(row.employee_band) : null,
    region,
    city,
    state,
    tags: [vertical, life, state].filter(Boolean) as string[],
    qualificationScore:
      row.qualification_score != null
        ? num(row.qualification_score)
        : null,
    source: row.source ? str(row.source) : null,
    phone: row.phone ? str(row.phone) : null,
    primaryContactName: contact?.name ?? null,
    primaryContactEmail: contact?.email ?? null,
    primaryContactPhone: contact?.phone ?? null,
    clientId: row.client_id ? str(row.client_id) : null,
    isTest: bool(row.is_test),
  };
}

export function mapContactRow(row: ProdContactRow): Contact {
  const name = str(row.name, "");
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] || "—";
  const lastName = parts.slice(1).join(" ") || "";
  return {
    id: str(row.contact_id || row.id),
    accountId: str(row.account_id),
    leadId: row.gtm_lead_id ? str(row.gtm_lead_id) : null,
    firstName,
    lastName,
    title: str(row.title, ""),
    email: str(row.email, ""),
    phone: row.phone != null ? str(row.phone) : null,
    isPrimary: bool(row.is_primary),
    ownerId: "unassigned",
    createdAt: str(row.created_at, new Date().toISOString()),
    updatedAt: str(row.updated_at || row.created_at, new Date().toISOString()),
  };
}
