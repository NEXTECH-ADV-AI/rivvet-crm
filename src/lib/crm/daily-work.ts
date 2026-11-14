import type { Account, Activity, Opportunity } from "./types";

/** Date-only deadlines stay on their local calendar day, rather than expiring at UTC midnight. */
export function dueState(
  value: string | null | undefined,
  now = Date.now(),
): "overdue" | "today" | "upcoming" | "unscheduled" {
  if (!value) return "unscheduled";
  const due = new Date(value.length === 10 ? `${value}T23:59:59` : value);
  if (!Number.isFinite(due.getTime())) return "unscheduled";
  const today = new Date(now);
  if (due.toDateString() === today.toDateString()) return "today";
  return due.getTime() < now ? "overdue" : "upcoming";
}

export function isInternalActivity(activity: Activity, accounts: Account[] = []): boolean {
  if (activity.type === "system" || activity.isTest) return true;
  if (
    activity.relatedType === "account" &&
    accounts.some((a) => a.id === activity.relatedId && a.isTest)
  )
    return true;
  // Explicit QA naming only, never a generic match for a word in a customer's message.
  return /^(?:rivvet\s+(?:test|qa)\b|e2e\b|qa\s+(?:test|smoke)\b)/i.test(activity.relatedName);
}

export type DailyWork = {
  id: string;
  title: string;
  record: string;
  href: string;
  due: string | null;
  state: ReturnType<typeof dueState>;
  reason: string;
  rank: number;
};
export function buildDailyWork(
  opportunities: Opportunity[],
  accounts: Account[],
  activities: Activity[],
  now = Date.now(),
): DailyWork[] {
  const items: DailyWork[] = [];
  const taskRecords = new Set<string>();
  for (const a of activities) {
    if (a.type !== "task" || a.completedAt || isInternalActivity(a, accounts)) continue;
    const state = dueState(a.dueAt, now);
    taskRecords.add(`${a.relatedType}:${a.relatedId}`);
    const route =
      a.relatedType === "opportunity"
        ? "opportunities"
        : a.relatedType === "account"
          ? "accounts"
          : "leads";
    items.push({
      id: `task:${a.id}`,
      title: a.subject,
      record: a.relatedName,
      href: `/${route}/${encodeURIComponent(a.relatedId)}`,
      due: a.dueAt,
      state,
      reason: "Open task",
      rank: state === "overdue" ? 0 : state === "today" ? 1 : 4,
    });
  }
  for (const o of opportunities) {
    if (["closed_won", "closed_lost"].includes(o.stage) || taskRecords.has(`opportunity:${o.id}`))
      continue;
    const state = dueState(o.nextActionDue, now);
    if (o.nextAction && state === "upcoming") continue;
    items.push({
      id: `opp:${o.id}`,
      title: o.nextAction || "Set the next step",
      record: o.name,
      href: `/opportunities/${encodeURIComponent(o.id)}`,
      due: o.nextActionDue,
      state,
      reason: !o.nextAction
        ? "Open deal has no next step"
        : state === "unscheduled"
          ? "Next step has no due date"
          : "Sales follow-up",
      rank: state === "overdue" ? 0 : state === "today" ? 1 : 3,
    });
  }
  for (const a of accounts) {
    if (a.isTest || a.status === "churned" || taskRecords.has(`account:${a.id}`)) continue;
    const customer =
      a.lifecycleStage === "customer" ||
      a.status === "active" ||
      a.status === "customer" ||
      a.status === "at_risk";
    const atRisk = a.health === "risk" || a.status === "at_risk";
    const state = dueState(a.nextActionDue, now);
    if (!customer || (!atRisk && a.nextAction && !["overdue", "today"].includes(state))) continue;
    items.push({
      id: `account:${a.id}`,
      title:
        a.nextActionKnown === false
          ? "Check customer follow-up"
          : a.nextAction || "Set a customer follow-up",
      record: a.name,
      href: `/accounts/${encodeURIComponent(a.id)}`,
      due: a.nextActionDue,
      state,
      reason:
        a.nextActionKnown === false
          ? "Next step could not be verified"
          : atRisk
            ? "Customer at risk"
            : !a.nextAction
              ? "Customer has no next step"
              : "Customer follow-up",
      rank: state === "overdue" ? 0 : state === "today" ? 1 : atRisk ? 2 : 3,
    });
  }
  return items.sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
      a.record.localeCompare(b.record),
  );
}
