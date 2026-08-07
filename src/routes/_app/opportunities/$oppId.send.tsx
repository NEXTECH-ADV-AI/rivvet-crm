import { useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { LockedBanner } from "@/components/crm/locked-banner";
import { IntegrationMirror } from "@/components/crm/integration-mirror";
import { useCrmStore } from "@/lib/crm/store";
import { formatMoney } from "@/lib/crm/priority";

export const Route = createFileRoute("/_app/opportunities/$oppId/send")({
  component: SendPreview,
});

function SendPreview() {
  const { oppId } = Route.useParams();
  const opportunities = useCrmStore((s) => s.opportunities);
  const allDocs = useCrmStore((s) => s.sendDocuments);
  const allPayments = useCrmStore((s) => s.payments);

  const opp = useMemo(
    () => opportunities.find((o) => o.id === oppId),
    [opportunities, oppId],
  );
  const docs = useMemo(
    () => allDocs.filter((d) => d.opportunityId === oppId),
    [allDocs, oppId],
  );
  const payments = useMemo(
    () => allPayments.filter((p) => p.opportunityId === oppId),
    [allPayments, oppId],
  );

  if (!opp) throw notFound();

  const steps = [
    { id: 1, label: "Review package", state: "done" as const },
    { id: 2, label: "PandaDoc document", state: "current" as const },
    { id: 3, label: "Stripe / payment", state: "todo" as const },
    { id: 4, label: "Signature", state: "todo" as const },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        to="/opportunities/$oppId"
        params={{ oppId }}
        className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> {opp.name}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-wider text-fg-subtle">
            CONTRACT / SEND · MIRROR SHELL
          </p>
          <h1 className="text-xl font-semibold text-ink">Send proposal</h1>
          <p className="text-sm text-fg-muted">
            {opp.accountName} · {formatMoney(opp.amount)} · send:{" "}
            <span className="font-mono">{opp.lockedSendState ?? "none"}</span> ·
            pay:{" "}
            <span className="font-mono">
              {opp.lockedPaymentState ?? "none"}
            </span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-warn/30 bg-warn/10 px-2 py-1 font-mono text-[10px] font-semibold text-warn">
          <Lock className="size-3" /> LOCKED
        </span>
      </div>

      <LockedBanner
        title="PandaDoc + Stripe path locked"
        body="External IDs below are mirrors only. No webhooks fire. No new required fields. Production payloads unchanged."
      />

      <ol className="grid gap-2 sm:grid-cols-4">
        {steps.map((s) => (
          <li
            key={s.id}
            className={`rounded-lg border px-3 py-3 text-xs ${
              s.state === "current"
                ? "border-bright-mint/50 bg-bright-mint/10 text-ink"
                : s.state === "done"
                  ? "border-border-soft bg-card text-fg-muted"
                  : "border-border-soft bg-mist text-fg-subtle"
            }`}
          >
            <span className="font-mono text-[10px]">0{s.id}</span>
            <p className="mt-1 font-medium">{s.label}</p>
          </li>
        ))}
      </ol>

      <IntegrationMirror docs={docs} payments={payments} />

      <div className="rounded-xl border border-border-soft bg-card p-5 shadow-card">
        <div className="space-y-3">
          <Field
            label="Recipient email"
            value={docs[0]?.recipientEmail ?? "— production field —"}
          />
          <Field
            label="PandaDoc template"
            value={docs[0]?.templateKey ?? "— production field —"}
          />
          <Field
            label="Stripe checkout"
            value={payments[0]?.externalId ?? "— none —"}
          />
        </div>
        <button
          type="button"
          disabled
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-ink/40 px-4 py-3 font-mono text-[11px] font-bold tracking-wider text-white"
        >
          <Lock className="size-3.5" />
          SEND DISABLED IN SANDBOX
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
        {label}
      </label>
      <div className="mt-1 rounded-md border border-border-soft bg-mist px-3 py-2.5 font-mono text-sm text-fg-muted">
        {value}
      </div>
    </div>
  );
}
