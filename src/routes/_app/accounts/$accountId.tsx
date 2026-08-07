import { useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { RecordHeader } from "@/components/crm/record-header";
import { Timeline } from "@/components/crm/timeline";
import { NextActionEditor } from "@/components/crm/next-action-editor";
import { PriorityBadge } from "@/components/crm/priority-badge";
import { MetaPanel, MetaRow, TagList } from "@/components/crm/meta-panel";
import { useCrmStore } from "@/lib/crm/store";
import { DEMO_NOW } from "@/lib/crm/seed";
import { activitiesForEntity } from "@/lib/crm/filters";
import {
  accountPriority,
  formatMoney,
  formatRelative,
  oppPriority,
  STAGE_LABEL,
} from "@/lib/crm/priority";

export const Route = createFileRoute("/_app/accounts/$accountId")({
  component: AccountDetail,
});

function AccountDetail() {
  const { accountId } = Route.useParams();
  const accounts = useCrmStore((s) => s.accounts);
  const allContacts = useCrmStore((s) => s.contacts);
  const allOpps = useCrmStore((s) => s.opportunities);
  const activities = useCrmStore((s) => s.activities);
  const setAccountNextAction = useCrmStore((s) => s.setAccountNextAction);
  const completeActivity = useCrmStore((s) => s.completeActivity);
  const logTouch = useCrmStore((s) => s.logTouch);

  const account = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId],
  );
  const contacts = useMemo(
    () => allContacts.filter((c) => c.accountId === accountId),
    [allContacts, accountId],
  );
  const opps = useMemo(
    () => allOpps.filter((o) => o.accountId === accountId),
    [allOpps, accountId],
  );
  const timeline = useMemo(
    () =>
      account
        ? activitiesForEntity(activities, "account", account.id)
        : [],
    [activities, account],
  );

  if (!account) throw notFound();
  const p = accountPriority(account, DEMO_NOW);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to="/accounts"
        className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Accounts
      </Link>

      <RecordHeader
        title={account.name}
        subtitle={`${account.domain} · ${account.industry} · ${account.region}`}
        status={STAGE_LABEL[account.status] ?? account.status}
        statusTone={
          account.status === "at_risk" || account.health === "risk"
            ? "danger"
            : "mint"
        }
        ownerId={account.ownerId}
        nextAction={account.nextAction}
        lastTouch={account.lastTouch}
        amount={account.arr ? formatMoney(account.arr) + " ARR" : null}
        priority={p.priority}
        reasons={p.reasons}
        actions={
          <button
            type="button"
            onClick={() =>
              logTouch(
                "account",
                account.id,
                account.name,
                "call",
                `Call — ${account.name}`,
              )
            }
            className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-deep-ink"
          >
            Log activity
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <MetaPanel title="Next step">
            <NextActionEditor
              nextAction={account.nextAction}
              nextActionDue={account.nextActionDue}
              onSave={(patch) => setAccountNextAction(account.id, patch)}
            />
          </MetaPanel>
          <MetaPanel title="Account fields">
            <MetaRow k="ID" v={account.id} mono />
            <MetaRow k="Health" v={account.health} mono />
            <MetaRow k="Employees" v={account.employeeBand ?? "—"} mono />
            <MetaRow k="Billing" v={account.billingEmail ?? "—"} />
            <MetaRow k="Open opps" v={String(account.openOpps)} mono />
            <MetaRow
              k="Created"
              v={formatRelative(account.createdAt, DEMO_NOW)}
              mono
            />
            <MetaRow k="Tags" v={<TagList tags={account.tags} />} />
          </MetaPanel>
          <MetaPanel title="Contacts">
            {contacts.length === 0 ? (
              <p className="text-xs text-fg-muted">No contacts linked.</p>
            ) : (
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-border-soft bg-mist/50 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-ink">
                      {c.firstName} {c.lastName}
                      {c.isPrimary && (
                        <span className="ml-2 font-mono text-[10px] text-product-mint">
                          PRIMARY
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-fg-subtle">
                      {c.title} · {c.email}
                    </p>
                    <p className="font-mono text-[10px] text-fg-subtle">
                      {c.id}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </MetaPanel>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <MetaPanel title="Opportunities">
            {opps.length === 0 ? (
              <p className="text-sm text-fg-muted">No opportunities linked.</p>
            ) : (
              <ul className="space-y-2">
                {opps.map((o) => {
                  const op = oppPriority(o, DEMO_NOW);
                  return (
                    <li key={o.id}>
                      <Link
                        to="/opportunities/$oppId"
                        params={{ oppId: o.id }}
                        className="flex items-center gap-3 rounded-lg border border-border-soft px-3 py-2.5 hover:bg-mist"
                      >
                        <PriorityBadge priority={op.priority} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {o.name}
                          </p>
                          <p className="text-[11px] text-fg-subtle">
                            {STAGE_LABEL[o.stage]} ·{" "}
                            {formatRelative(o.lastTouch, DEMO_NOW)}
                          </p>
                        </div>
                        <span className="font-mono text-xs font-semibold tabular">
                          {formatMoney(o.amount)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </MetaPanel>
          <MetaPanel title="Activity timeline">
            <Timeline items={timeline} onComplete={completeActivity} />
          </MetaPanel>
        </div>
      </div>
    </div>
  );
}
