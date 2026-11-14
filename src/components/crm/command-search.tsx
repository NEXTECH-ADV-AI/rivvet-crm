import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Search CRM"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-border-soft bg-card px-3 py-1.5 text-xs text-fg-muted shadow-soft hover:border-product-mint/40"
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-border-soft bg-mist px-1.5 font-mono text-[10px] sm:inline">
            ⌘K
          </kbd>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-deep-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-[12dvh] z-50 flex max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border-soft bg-card shadow-card">
          <Dialog.Title className="sr-only">Search CRM</Dialog.Title>
          <Dialog.Description className="sr-only">
            Find loaded leads, accounts and opportunities by ID, name or domain.
          </Dialog.Description>
          <div className="flex items-center gap-2 border-b border-border-soft px-3">
            <Search className="size-4 shrink-0 text-fg-subtle" aria-hidden />
            <input
              aria-label="Search leads, accounts and opportunities"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search leads, accounts, opps…"
              className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink outline-none placeholder:text-fg-subtle"
            />
            <Dialog.Close
              aria-label="Close search"
              className="flex size-11 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-mist"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <ul className="min-h-0 overflow-y-auto overscroll-contain py-1">
            {results.length === 0 && (
              <li role="status" className="px-4 py-6 text-center text-xs text-fg-subtle">
                {q ? "No matches" : "Type an ID, name, or domain"}
              </li>
            )}
            {results.map((r) => (
              <li key={r.kind + r.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-mist"
                  onClick={() => go(r)}
                >
                  <span className="w-14 shrink-0 font-mono text-[10px] text-fg-subtle">
                    {r.kind}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{r.label}</span>
                    <span className="block truncate text-[11px] text-fg-subtle">
                      {r.sub} · {r.id}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
