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
import { useAccount } from "@/lib/crm/wire";
import { VERTICAL_LABEL } from "@/lib/crm/lead-model";

export const Route = createFileRoute("/_app/accounts/$accountId")({
  component: AccountDetail,
});

function AccountDetail() {
  const { accountId } = Route.useParams();
  const accountQ = useAccount(accountId);
  const allOpps = useCrmStore((s) => s.opportunities);
  const activities = useCrmStore((s) => s.activities);
  const setAccountNextAction = useCrmStore((s) => s.setAccountNextAction);
  const completeActivity = useCrmStore((s) => s.completeActivity);
  const logTouch = useCrmStore((s) => s.logTouch);

  const account = accountQ.data?.account ?? null;
  const contacts = accountQ.data?.contacts ?? [];
  const source = accountQ.data?.source ?? "mock";

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

  if (accountQ.isLoading) {
    return (
      <p className="px-4 py-16 text-center text-sm text-fg-muted">
        Loading account…
      </p>
    );
  }

  if (!account) {
    if (accountQ.isError || accountQ.isSuccess) throw notFound();
    return null;
  }

  const p = accountPriority(account, DEMO_NOW);
  const life = account.lifecycleStage ?? account.status;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to="/accounts"
        className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Accounts
      </Link>

      {accountQ.data?.message && (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs">
          {accountQ.data.message}
        </p>
      )}

      <RecordHeader
        title={account.name}
        subtitle={`${account.domain ?? "—"} · ${(account.vertical && VERTICAL_LABEL[account.vertical]) || account.industry} · ${account.region} · ${source}`}
        status={STAGE_LABEL[life] ?? life}
        statusTone={
          life === "churned" || account.health === "risk"
            ? "danger"
            : life === "customer"
              ? "mint"
              : "neutral"
        }
        ownerId={account.ownerId}
        nextAction={account.nextAction}
        lastTouch={account.lastTouch}
        amount={
          account.arr
            ? formatMoney(account.arr) + " ARR"
            : account.qualificationScore != null
              ? `ICP ${account.qualificationScore}`
              : null
        }
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
            {source === "live" && (
              <p className="mt-2 text-[10px] text-fg-subtle">
                Next action is local until accounts patch is wired.
              </p>
            )}
          </MetaPanel>
          <MetaPanel title="Account fields">
            <MetaRow k="ID" v={account.id} mono />
            <MetaRow k="Lifecycle" v={STAGE_LABEL[life] ?? life} />
            <MetaRow k="Owner email" v={account.ownerEmail ?? "—"} />
            <MetaRow k="Phone" v={account.phone ?? "—"} mono />
            <MetaRow k="Source" v={account.source ?? "—"} />
            <MetaRow
              k="ICP score"
              v={
                account.qualificationScore != null
                  ? String(account.qualificationScore)
                  : "—"
              }
              mono
            />
            <MetaRow k="Client id" v={account.clientId ?? "—"} mono />
            <MetaRow
              k="Updated"
              v={formatRelative(account.updatedAt, DEMO_NOW)}
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
                    {c.phone && (
                      <p className="font-mono text-[10px] text-fg-subtle">
                        {c.phone}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </MetaPanel>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <MetaPanel title="Opportunities">
            {opps.length === 0 ? (
              <p className="text-sm text-fg-muted">
                {source === "live"
                  ? "Linked opps load from crm_opportunities when that wire lands (seed opps only if IDs match)."
                  : "No opportunities linked in mock seed."}
              </p>
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
