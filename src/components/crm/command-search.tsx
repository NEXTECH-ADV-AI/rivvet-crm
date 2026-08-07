import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useCrmStore } from "@/lib/crm/store";

type Hit =
  | { kind: "Lead"; id: string; label: string; sub: string }
  | { kind: "Account"; id: string; label: string; sub: string }
  | { kind: "Opp"; id: string; label: string; sub: string };

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const leads = useCrmStore((s) => s.leads);
  const accounts = useCrmStore((s) => s.accounts);
  const opps = useCrmStore((s) => s.opportunities);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [] as Hit[];
    const out: Hit[] = [];
    for (const l of leads) {
      if (
        l.name.toLowerCase().includes(query) ||
        l.company.toLowerCase().includes(query) ||
        l.id.toLowerCase().includes(query) ||
        l.email.toLowerCase().includes(query)
      ) {
        out.push({ kind: "Lead", id: l.id, label: l.name, sub: l.company });
      }
    }
    for (const a of accounts) {
      if (
        a.name.toLowerCase().includes(query) ||
        (a.domain ?? "").toLowerCase().includes(query) ||
        a.id.toLowerCase().includes(query)
      ) {
        out.push({
          kind: "Account",
          id: a.id,
          label: a.name,
          sub: a.domain ?? "",
        });
      }
    }
    for (const o of opps) {
      if (
        o.name.toLowerCase().includes(query) ||
        o.accountName.toLowerCase().includes(query) ||
        o.id.toLowerCase().includes(query)
      ) {
        out.push({
          kind: "Opp",
          id: o.id,
          label: o.name,
          sub: o.accountName,
        });
      }
    }
    return out.slice(0, 12);
  }, [q, leads, accounts, opps]);

  function go(hit: Hit) {
    setOpen(false);
    setQ("");
    if (hit.kind === "Lead") {
      void navigate({ to: "/leads/$leadId", params: { leadId: hit.id } });
    } else if (hit.kind === "Account") {
      void navigate({
        to: "/accounts/$accountId",
        params: { accountId: hit.id },
      });
    } else {
      void navigate({ to: "/opportunities/$oppId", params: { oppId: hit.id } });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-border-soft bg-card px-3 py-1.5 text-xs text-fg-muted shadow-soft hover:border-product-mint/40"
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-border-soft bg-mist px-1.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-deep-ink/40 px-4 pt-[12vh]">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close search"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border-soft bg-card shadow-card">
            <div className="flex items-center gap-2 border-b border-border-soft px-3">
              <Search className="size-4 text-fg-subtle" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search leads, accounts, opps…"
                className="w-full bg-transparent py-3 text-sm text-ink outline-none placeholder:text-fg-subtle"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.length === 0 && (
                <li className="px-4 py-6 text-center text-xs text-fg-subtle">
                  {q ? "No matches" : "Type an ID, name, or domain"}
                </li>
              )}
              {results.map((r) => (
                <li key={r.kind + r.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-mist"
                    onClick={() => go(r)}
                  >
                    <span className="w-14 shrink-0 font-mono text-[10px] text-fg-subtle">
                      {r.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {r.label}
                      </span>
                      <span className="block truncate text-[11px] text-fg-subtle">
                        {r.sub} · {r.id}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
