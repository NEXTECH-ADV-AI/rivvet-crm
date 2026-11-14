import { useState } from "react";
import { ListTodo } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/crm/page-header";
import { StatusChip } from "@/components/crm/status-chip";
import { EmptyState } from "@/components/crm/empty-state";
import { useCrmStore } from "@/lib/crm/store";
import { dueState, isInternalActivity } from "@/lib/crm/daily-work";
import { formatRelative } from "@/lib/crm/priority";
import { completeTaskFn } from "@/lib/crm/wire";

export const Route = createFileRoute("/_app/activities")({
  component: ActivitiesPage,
});

const fmtDue = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function ActivitiesPage() {
  const now = Date.now();
  const accounts = useCrmStore((s) => s.accounts);
  const message = useCrmStore((s) => s.hydrateMessage);
  const hydratedAt = useCrmStore((s) => s.hydratedAt);
  const [includeInternal, setIncludeInternal] = useState(false);
  const activities = useCrmStore((s) => s.activities);
  const completeActivity = useCrmStore((s) => s.completeActivity);
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hidden = activities.filter((a) => isInternalActivity(a, accounts)).length;
  const visible = includeInternal ? activities : activities.filter((a) => !isInternalActivity(a, accounts));

  // Open = real tasks only. Past calls and emails are history, not work.
  const open = visible
    .filter((a) => a.type === "task" && !a.completedAt)
    .sort((a, b) => {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
  const history = visible
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
        <span>{visible.length} loaded activity records{hidden && !includeInternal ? `; ${hidden} test or system records hidden` : ""}.</span>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeInternal} onChange={(event) => setIncludeInternal(event.target.checked)} />Include test and system events</label>
      </div>
      {!hydratedAt && <p className="mb-4 text-sm text-fg-muted">Loading activity...</p>}
      {message?.includes("activities unavailable") && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Activity data is unavailable. An empty list does not mean there is no work due.</p>}
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
              const overdue = dueState(a.dueAt, now) === "overdue";
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
          <h2 className="text-sm font-semibold text-fg-muted">Recent customer activity</h2>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-3 text-sm text-fg-muted">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-border-soft">
            {history.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 break-words">
                  <span className="mr-2 rounded bg-mist px-1.5 py-0.5 text-[10px] font-semibold capitalize text-fg-muted">{a.type.replace(/_/g, " ")}</span><span className="font-medium text-ink/90">{a.subject}</span>
                  <span className="text-fg-muted">
                    {" · "}
                    <RelatedLink type={a.relatedType} id={a.relatedId} name={a.relatedName} />
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-fg-subtle">
                  {a.completedAt ? formatRelative(a.completedAt, now) : ""}
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
