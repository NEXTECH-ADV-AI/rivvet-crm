import { Lock } from "lucide-react";
import type { PaymentMirror, SendDocumentMirror } from "@/lib/crm/types";
import { formatDate, formatMoney } from "@/lib/crm/priority";
import { StatusChip } from "./status-chip";
import { MetaPanel, MetaRow } from "./meta-panel";

export function IntegrationMirror({
  docs,
  payments,
}: {
  docs: SendDocumentMirror[];
  payments: PaymentMirror[];
}) {
  if (docs.length === 0 && payments.length === 0) {
    return (
      <MetaPanel title="Integrations (read-only mirror)">
        <p className="text-xs text-fg-muted">
          No PandaDoc / Stripe records for this opportunity.
        </p>
      </MetaPanel>
    );
  }

  return (
    <MetaPanel title="Integrations (read-only mirror)">
      <div className="mb-3 flex items-center gap-1.5 text-[11px] text-warn">
        <Lock className="size-3" />
        Not connected — sandbox mirrors only. Mutations disabled.
      </div>
      {docs.map((d) => (
        <div
          key={d.id}
          className="mb-3 rounded-lg border border-border-soft bg-mist/60 px-3 py-2 last:mb-0"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink">PandaDoc</span>
            <StatusChip label={d.status} tone={toneDoc(d.status)} />
          </div>
          <MetaRow k="External ID" v={d.externalId} mono />
          <MetaRow k="Template" v={d.templateKey} mono />
          <MetaRow k="Recipient" v={d.recipientEmail} />
          <MetaRow k="Amount" v={formatMoney(d.amount)} mono />
          <MetaRow k="Created" v={formatDate(d.createdAt)} mono />
          {d.sentAt && <MetaRow k="Sent" v={formatDate(d.sentAt)} mono />}
          {d.signedAt && <MetaRow k="Signed" v={formatDate(d.signedAt)} mono />}
        </div>
      ))}
      {payments.map((p) => (
        <div
          key={p.id}
          className="mb-3 rounded-lg border border-border-soft bg-mist/60 px-3 py-2 last:mb-0"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink">Stripe</span>
            <StatusChip label={p.status} tone={tonePay(p.status)} />
          </div>
          <MetaRow k="External ID" v={p.externalId} mono />
          <MetaRow k="Amount" v={formatMoney(p.amount)} mono />
          <MetaRow k="Created" v={formatDate(p.createdAt)} mono />
          {p.paidAt && <MetaRow k="Paid" v={formatDate(p.paidAt)} mono />}
        </div>
      ))}
    </MetaPanel>
  );
}

function toneDoc(
  s: string,
): "neutral" | "mint" | "warn" | "danger" | "cyan" {
  if (s === "signed") return "mint";
  if (s === "sent" || s === "viewed") return "cyan";
  if (s === "void") return "danger";
  return "neutral";
}

function tonePay(
  s: string,
): "neutral" | "mint" | "warn" | "danger" | "cyan" {
  if (s === "paid") return "mint";
  if (s === "pending" || s === "processing") return "warn";
  if (s === "failed") return "danger";
  return "neutral";
}
