/** The editable fields on an Opportunity page and where each one is stored (RIV-1558):
 *  name, amount, close date on crm_opportunities; company and vertical on accounts;
 *  contact on contacts; next step is one open crm_tasks row (see next-action). */
export type OpportunityForm = {
  name: string;
  amount: number | null;
  closeDate: string | null;
  company: string;
  vertical: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  nextStep: string;
  nextStepDue: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Loose on purpose: stored contacts are sent back on every save, so legacy values must still pass.
// Both only ever go into a JSON body, never a PostgREST filter.
const EMAIL = /^[^\s@]+@[^\s@]+$/;
const PHONE = /^[0-9a-zA-Z+().#\-\s]{0,40}$/;

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function day(v: unknown, label: string): string | null {
  const s = text(v, 10);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
    throw new Error(`${label} needs a real date`);
  }
  return s;
}

/** Trust boundary for saveOpportunityFn: the id is a uuid, every field is trimmed and checked. */
export function parseOpportunitySave(data: unknown): { opportunityId: string; form: OpportunityForm } {
  const d = (data ?? {}) as Record<string, unknown>;
  const f = (d.form ?? {}) as Record<string, unknown>;
  const opportunityId = String(d.opportunityId ?? "");
  if (!UUID.test(opportunityId)) throw new Error("Invalid opportunity id");

  const name = text(f.name, 200);
  if (!name) throw new Error("The opportunity needs a name");

  let amount: number | null = null;
  if (f.amount !== null && f.amount !== undefined && String(f.amount).trim() !== "") {
    amount = Number(String(f.amount).replace(/[$,\s]/g, ""));
    if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) throw new Error("Amount needs to be a dollar figure");
  }

  const contactEmail = text(f.contactEmail, 200).toLowerCase();
  if (contactEmail && !EMAIL.test(contactEmail)) throw new Error("That email doesn't look right");
  const contactPhone = text(f.contactPhone, 40);
  if (!PHONE.test(contactPhone)) throw new Error("That phone number doesn't look right");

  return {
    opportunityId,
    form: {
      name,
      amount,
      closeDate: day(f.closeDate, "Expected close"),
      company: text(f.company, 200),
      vertical: text(f.vertical, 60),
      contactName: text(f.contactName, 200),
      contactEmail,
      contactPhone,
      nextStep: text(f.nextStep, 200),
      nextStepDue: day(f.nextStepDue, "Next step due"),
    },
  };
}

/** Which contact the Contact fields edit: the opportunity's own, else the account's primary, else the
 *  account's first contact. Null means saving creates one (when the account exists). */
export function pickContactId(
  oppContactId: string | null,
  accountContactId: string | null,
  accountContacts: { contact_id: string; is_primary: boolean }[],
): string | null {
  return oppContactId ?? accountContactId ?? accountContacts.find((c) => c.is_primary)?.contact_id ?? accountContacts[0]?.contact_id ?? null;
}

/** True when the form differs from what was loaded, so Save only lights up for a real change. */
export const formChanged = (a: OpportunityForm, b: OpportunityForm) => JSON.stringify(a) !== JSON.stringify(b);
