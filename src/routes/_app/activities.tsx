import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/page-header";
import { StatusChip } from "@/components/crm/status-chip";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW } from "@/lib/crm/seed";
import { formatRelative, OWNER_LABEL, daysUntil } from "@/lib/crm/priority";

export const Route = createFileRoute("/_app/activities")({
  component: ActivitiesPage,
});

function ActivitiesPage() {
  const activities = useCrmStore((s) => s.activities);
  const completeActivity = useCrmStore((s) => s.completeActivity);

  const open = activities
    .filter((a) => !a.completedAt)
    .sort((a, b) => {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
  const done = activities
    .filter((a) => a.completedAt)
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Activities"
        description="Tasks and touches — activity table mirror. Complete updates local store only."
      />

      <section className="mb-6 rounded-xl border border-border-soft bg-card shadow-card">
        <div className="border-b border-border-soft px-4 py-3">
          <h2 className="text-sm font-semibold">Open</h2>
        </div>
        <ul className="divide-y divide-border-soft">
          {open.map((a) => {
            const overdue =
              a.dueAt != null && daysUntil(a.dueAt, DEMO_NOW) < 0;
            return (
              <li
                key={a.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip label={a.type.replace("_", " ")} tone="neutral" />
                    {overdue && <StatusChip label="Overdue" tone="danger" />}
                    <span className="font-mono text-[10px] text-fg-subtle">
                      {a.id}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink">{a.subject}</p>
                  {a.body && (
                    <p className="text-[11px] text-fg-muted line-clamp-1">
                      {a.body}
                    </p>
                  )}
                  <p className="text-[11px] text-fg-subtle">
                    {OWNER_LABEL[a.ownerId]} ·{" "}
                    <RelatedLink
                      type={a.relatedType}
                      id={a.relatedId}
                      name={a.relatedName}
                    />
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs tabular text-fg-muted">
                    {a.dueAt
                      ? overdue
                        ? `Due ${formatRelative(a.dueAt, DEMO_NOW)}`
                        : `Due ${a.dueAt}`
                      : "No due date"}
                  </span>
                  <button
                    type="button"
                    onClick={() => completeActivity(a.id)}
                    className="rounded-md border border-border-soft px-2 py-1 text-[11px] font-semibold hover:bg-mist"
                  >
                    Done
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {done.length > 0 && (
        <section className="rounded-xl border border-border-soft bg-card/80 shadow-soft">
          <div className="border-b border-border-soft px-4 py-3">
            <h2 className="text-sm font-semibold text-fg-muted">
              Recently completed
            </h2>
          </div>
          <ul className="divide-y divide-border-soft">
            {done.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm text-fg-muted">
                <span className="font-medium text-ink/80">{a.subject}</span>
                <span className="ml-2 font-mono text-[10px]">
                  {a.completedAt
                    ? formatRelative(a.completedAt, DEMO_NOW)
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
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
