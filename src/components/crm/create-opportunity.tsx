import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Target } from "lucide-react";
import { useAccountsList, useCreateOpportunity } from "@/lib/crm/wire";
import { useCrmStore } from "@/lib/crm/store";
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

type Picked = { kind: "account"; id: string; name: string; detail: string } | { kind: "new"; name: string };

function StageSelect({ value, onChange }: { value: NewOppStage; onChange: (v: NewOppStage) => void }) {
  return (
    <label className="block text-xs text-fg-muted">
      Stage
      <select value={value} onChange={(e) => onChange(e.target.value as NewOppStage)} className={field}>
        {NEW_OPP_STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The Opportunities tab form. Typing searches accounts; pick one, or start a new company
 * when nothing matches (RIV-1555).
 */
export function NewOpportunityForm({ onCancel }: { onCancel: () => void }) {
  const { create, run } = useCreateAndOpen();
  const opportunities = useCrmStore((s) => s.opportunities);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [stage, setStage] = useState<NewOppStage>("qualified");
  const [contact, setContact] = useState({ contact: "", email: "", phone: "" });

  // Search after a short pause so each keystroke doesn't hit the database.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const matches = useAccountsList({ query: search, limit: 6, offset: 0 });
  const accounts = search.length >= 2 ? (matches.data?.accounts ?? []) : [];
  const options: Picked[] = [
    ...accounts.map((a) => ({
      kind: "account" as const,
      id: a.id,
      name: a.name,
      detail: [a.region, a.domain?.replace(/^https?:\/\/(www\.)?|\/$/g, "")].filter(Boolean).join(" · "),
    })),
    ...(query.trim() ? [{ kind: "new" as const, name: query.trim() }] : []),
  ];
  const openOpp =
    picked?.kind === "account"
      ? opportunities.find((o) => o.accountId === picked.id && o.stage !== "closed_won" && o.stage !== "closed_lost")
      : undefined;

  function choose(o: Picked) {
    setPicked(o);
    create.reset();
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, options.length - 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
    else if (e.key === "Enter" && options[active]) choose(options[active]);
    else return;
    e.preventDefault();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!picked) return;
    if (picked.kind === "account") run({ from: "account", accountId: picked.id, stage });
    else run({ from: "new", company: picked.name, stage, ...contact });
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-border-soft bg-card p-4 shadow-card">
      <h2 className="text-sm font-semibold text-ink">New opportunity</h2>

      {!picked ? (
        <div className="relative mt-3">
          <label className="block text-xs text-fg-muted">
            Company
            <input
              autoFocus
              role="combobox"
              aria-expanded={options.length > 0}
              aria-controls="opp-company-options"
              aria-activedescendant={options[active] ? `opp-company-${active}` : undefined}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder="Start typing a company name"
              className={field}
            />
          </label>
          {options.length > 0 && (
            <ul
              id="opp-company-options"
              role="listbox"
              className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border-soft bg-card shadow-card"
            >
              {options.map((o, i) => (
                <li
                  key={o.kind === "account" ? o.id : "new"}
                  id={`opp-company-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o);
                  }}
                  className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-mist" : ""} ${o.kind === "new" ? "border-t border-border-soft" : ""}`}
                >
                  {o.kind === "account" ? (
                    <>
                      <span className="font-medium text-ink">{o.name}</span>
                      {o.detail && <span className="ml-2 text-xs text-fg-subtle">{o.detail}</span>}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-medium text-product-mint">
                      <Plus className="size-3.5" aria-hidden /> New company "{o.name}"
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-fg-subtle">
            {search.length >= 2 && matches.isFetching
              ? "Searching accounts…"
              : "Pick an existing account, or add a new company if it isn't here."}
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border-soft bg-mist/60 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{picked.name}</p>
              <p className="text-xs text-fg-subtle">
                {picked.kind === "account" ? picked.detail || "Existing account" : "New company"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="shrink-0 text-xs font-medium text-fg-muted hover:text-ink"
            >
              Change
            </button>
          </div>
          {openOpp ? (
            <p className="text-sm text-fg-muted">
              This account already has an open opportunity.{" "}
              <Link
                to="/opportunities/$oppId"
                params={{ oppId: openOpp.id }}
                className="font-semibold text-product-mint hover:underline"
              >
                Open it
              </Link>
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {picked.kind === "new" && (
                <>
                  <label className="block text-xs text-fg-muted">
                    Contact name
                    <input
                      autoFocus
                      value={contact.contact}
                      onChange={(e) => setContact((c) => ({ ...c, contact: e.target.value }))}
                      placeholder="Dana Ortiz"
                      className={field}
                    />
                  </label>
                  <label className="block text-xs text-fg-muted">
                    Email
                    <input
                      type="email"
                      value={contact.email}
                      onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                      placeholder="dana@hillsidehvac.com"
                      className={field}
                    />
                  </label>
                  <label className="block text-xs text-fg-muted">
                    Phone
                    <input
                      type="tel"
                      value={contact.phone}
                      onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                      placeholder="(303) 555-0142"
                      className={field}
                    />
                  </label>
                </>
              )}
              <StageSelect value={stage} onChange={setStage} />
            </div>
          )}
        </div>
      )}

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
        {picked && !openOpp && (
          <button type="submit" disabled={create.isPending} className={primary}>
            {create.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {create.isPending ? "Creating…" : "Create opportunity"}
          </button>
        )}
      </div>
    </form>
  );
}
