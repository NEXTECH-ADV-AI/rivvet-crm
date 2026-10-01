import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CALL_OUTCOMES, type CallOutcome } from "@/lib/crm/call-log";
import { VERTICAL_LABEL } from "@/lib/crm/lead-model";
import { logCallFn } from "@/lib/crm/wire";
import type { Lead } from "@/lib/crm/types";
import { cn } from "@/components/ui/cn";

const LINE_LABEL: Record<string, string> = {
  mobile: "Cell",
  landline: "Landline",
  fixedVoip: "Office line",
  nonFixedVoip: "Internet line",
  tollFree: "Toll-free",
};

function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
}

/** Hand-dial queue: email openers with a phone (RIV-1537). Nothing here dials. */
export function CallQueue({ leads }: { leads: Lead[] }) {
  return (
    <ul className="divide-y divide-border-soft">
      {leads.map((l) => (
        <CallRow key={l.id} lead={l} />
      ))}
    </ul>
  );
}

function CallRow({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const line = lead.phoneLineType ? LINE_LABEL[lead.phoneLineType] ?? null : null;
  const where = [lead.city, lead.state].filter(Boolean).join(", ");

  async function save() {
    if (!outcome || !lead.gtmLeadId) return;
    setState("saving");
    setError(null);
    try {
      await logCallFn({
        data: {
          gtmLeadId: lead.gtmLeadId,
          outcome,
          note,
          callbackAt: outcome === "callback" && callbackAt ? new Date(callbackAt).toISOString() : null,
        },
      });
      setState("saved");
      void qc.invalidateQueries({ queryKey: ["crm", "leads"] });
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Couldn't save the call. Try again.");
    }
  }

  return (
    <li className={cn("grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,22rem)] lg:items-center", state === "saved" && "opacity-50")}>
      <div className="min-w-0">
        <Link to="/leads/$leadId" params={{ leadId: lead.id }} className="font-semibold text-ink hover:text-product-mint">
          {lead.company || lead.name}
        </Link>
        <p className="truncate text-xs text-fg-muted">
          {[lead.name !== lead.company ? lead.name : null, VERTICAL_LABEL[lead.vertical] ?? lead.vertical, where]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-semibold tabular-nums text-white transition hover:bg-ink/90 active:scale-[0.98]"
          >
            <Phone className="size-4" aria-hidden />
            {formatPhone(lead.phone)}
          </a>
        )}
        {line && (
          <span className="rounded border border-border-soft px-1.5 py-0.5 text-[11px] text-fg-muted">{line}</span>
        )}
      </div>

      {state === "saved" ? (
        <p className="text-sm text-product-mint">Logged.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`o-${lead.id}`}>Call outcome</label>
          <select
            id={`o-${lead.id}`}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as CallOutcome)}
            className="rounded-md border border-border-soft bg-card px-2 py-1.5 text-sm"
          >
            <option value="">How did it go?</option>
            {CALL_OUTCOMES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {outcome === "callback" && (
            <input
              type="datetime-local"
              aria-label="Call back at"
              value={callbackAt}
              onChange={(e) => setCallbackAt(e.target.value)}
              className="rounded-md border border-border-soft bg-card px-2 py-1.5 text-sm"
            />
          )}
          <input
            type="text"
            placeholder="Note (optional)"
            aria-label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border-soft bg-card px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={!outcome || state === "saving" || (outcome === "callback" && !callbackAt)}
            onClick={() => void save()}
            className="rounded-md border border-border-soft px-3 py-1.5 text-sm font-semibold transition hover:bg-mist active:scale-[0.98] disabled:opacity-40"
          >
            {state === "saving" ? "Saving…" : "Log call"}
          </button>
          {error && (
            <p role="alert" className="w-full text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
