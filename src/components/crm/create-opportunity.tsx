import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Target } from "lucide-react";
import { useCreateOpportunity } from "@/lib/crm/wire";
import { NEW_OPP_STAGES, type NewOppStage } from "@/lib/crm/opportunity-create";

const primary =
  "inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:bg-deep-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const field =
  "mt-1 w-full rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink placeholder:text-fg-subtle focus:border-product-mint focus:outline-none";

function useCreateAndOpen() {
  const create = useCreateOpportunity();
  const navigate = useNavigate();
  return {
    create,
    run: (input: Parameters<typeof create.mutate>[0]) =>
      create.mutate(input, {
        onSuccess: (r) =>
          void navigate({ to: "/opportunities/$oppId", params: { oppId: r.opportunityId } }),
      }),
  };
}

/** On a lead or account page: open its Opportunity, or create one (RIV-1555). */
export function CreateOpportunityButton({
  record,
  existingId,
}: {
  record: { gtmLeadId: string } | { accountId: string };
  existingId?: string | null;
}) {
  const { create, run } = useCreateAndOpen();
  if (existingId) {
    return (
      <Link to="/opportunities/$oppId" params={{ oppId: existingId }} className={primary}>
        <Target className="size-3.5" aria-hidden /> Open opportunity
      </Link>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={create.isPending}
        onClick={() =>
          run("gtmLeadId" in record ? { from: "lead", ...record } : { from: "account", ...record })
        }
        className={primary}
      >
        {create.isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Plus className="size-3.5" aria-hidden />
        )}
        {create.isPending ? "Creating…" : "Create opportunity"}
      </button>
      {create.isError && (
        <span role="alert" className="text-[11px] text-danger">
          {create.error instanceof Error ? create.error.message : "Couldn't create it. Try again."}
        </span>
      )}
    </span>
  );
}

/** The Opportunities tab form for a company that isn't in the CRM yet. */
export function NewOpportunityForm({ onCancel }: { onCancel: () => void }) {
  const { create, run } = useCreateAndOpen();
  const [form, setForm] = useState({
    company: "",
    contact: "",
    email: "",
    phone: "",
    stage: "qualified" as NewOppStage,
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    run({ from: "new", ...form });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-xl border border-border-soft bg-card p-4 shadow-card"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">New opportunity</h2>
        <p className="text-xs text-fg-muted">An email already in the CRM uses that lead.</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-fg-muted">
          Company *
          <input
            required
            value={form.company}
            onChange={set("company")}
            placeholder="Hillside Heating & Air"
            className={field}
          />
        </label>
        <label className="block text-xs text-fg-muted">
          Contact name
          <input
            value={form.contact}
            onChange={set("contact")}
            placeholder="Dana Ortiz"
            className={field}
          />
        </label>
        <label className="block text-xs text-fg-muted">
          Email
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="dana@hillsidehvac.com"
            className={field}
          />
        </label>
        <label className="block text-xs text-fg-muted">
          Phone
          <input
            type="tel"
            value={form.phone}
            onChange={set("phone")}
            placeholder="(303) 555-0142"
            className={field}
          />
        </label>
        <label className="block text-xs text-fg-muted">
          Stage
          <select value={form.stage} onChange={set("stage")} className={field}>
            {NEW_OPP_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {create.isError && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger"
        >
          {create.error instanceof Error ? create.error.message : "Couldn't create it. Try again."}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-2 text-xs font-medium text-fg-muted hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={create.isPending || !form.company.trim()}
          className={primary}
        >
          {create.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {create.isPending ? "Creating…" : "Create opportunity"}
        </button>
      </div>
    </form>
  );
}
