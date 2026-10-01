import { useState } from "react";
import { ListTodo } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/crm/page-header";
import { StatusChip } from "@/components/crm/status-chip";
import { EmptyState } from "@/components/crm/empty-state";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW } from "@/lib/crm/seed";
import { formatRelative, daysUntil } from "@/lib/crm/priority";
import { completeTaskFn } from "@/lib/crm/wire";

export const Route = createFileRoute("/_app/activities")({
  component: ActivitiesPage,
});

const fmtDue = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function ActivitiesPage() {
  const activities = useCrmStore((s) => s.activities);
  const completeActivity = useCrmStore((s) => s.completeActivity);
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Open = real tasks only. Past calls and emails are history, not work.
  const open = activities
    .filter((a) => a.type === "task" && !a.completedAt)
    .sort((a, b) => {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
  const history = activities
    .filter((a) => a.completedAt)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, 25);

  async function markDone(id: string) {
    setSaving(id);
    setError(null);
    try {
      await completeTaskFn({ data: { taskId: id } });
      completeActivity(id);
      void qc.invalidateQueries({ queryKey: ["crm", "hydrate"] });
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Activities" description="Open tasks first, then the latest calls and emails." />

      <section className="mb-6 rounded-xl border border-border-soft bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <h2 className="text-sm font-semibold">Open tasks</h2>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        </div>
        {open.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={ListTodo} title="No open tasks" body="Call-backs and follow-ups show up here when they are due." />
          </div>
        ) : (
          <ul className="divide-y divide-border-soft">
            {open.map((a) => {
              const overdue = a.dueAt != null && daysUntil(a.dueAt, DEMO_NOW) < 0;
              return (
                <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{a.subject}</p>
                    <p className="text-xs text-fg-muted">
                      <RelatedLink type={a.relatedType} id={a.relatedId} name={a.relatedName} />
                      {a.body ? ` · ${a.body}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {overdue && <StatusChip label="Overdue" tone="danger" />}
                    <span className="text-xs tabular-nums text-fg-muted">
                      {a.dueAt ? `Due ${fmtDue(a.dueAt)}` : "No due date"}
                    </span>
                    <button
                      type="button"
                      disabled={saving === a.id}
                      onClick={() => void markDone(a.id)}
                      className="rounded-md border border-border-soft px-2.5 py-1 text-xs font-semibold transition hover:bg-mist active:scale-[0.98] disabled:opacity-50"
                    >
                      {saving === a.id ? "Saving…" : "Done"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border-soft bg-card/80 shadow-soft">
        <div className="border-b border-border-soft px-4 py-3">
          <h2 className="text-sm font-semibold text-fg-muted">Recent calls and emails</h2>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-3 text-sm text-fg-muted">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-border-soft">
            {history.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium text-ink/90">{a.subject}</span>
                  <span className="text-fg-muted">
                    {" · "}
                    <RelatedLink type={a.relatedType} id={a.relatedId} name={a.relatedName} />
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-fg-subtle">
                  {a.completedAt ? formatRelative(a.completedAt, DEMO_NOW) : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RelatedLink({
  type,
  id,
  name,
}: {
  type: string;
  id: string;
  name: string;
}) {
  if (type === "lead") {
    return (
      <Link
        to="/leads/$leadId"
        params={{ leadId: id }}
        className="hover:text-product-mint"
      >
        {name}
      </Link>
    );
  }
  if (type === "account") {
    return (
      <Link
        to="/accounts/$accountId"
        params={{ accountId: id }}
        className="hover:text-product-mint"
      >
        {name}
      </Link>
    );
  }
  if (type === "opportunity") {
    return (
      <Link
        to="/opportunities/$oppId"
        params={{ oppId: id }}
        className="hover:text-product-mint"
      >
        {name}
      </Link>
    );
  }
  return <span>{name}</span>;
}
