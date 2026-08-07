import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Users,
  Building2,
  Target,
  ListTodo,
  BarChart3,
  Settings,
  Mail,
} from "lucide-react";
import { RivvetIcon, RivvetWordmarkOnDark } from "./logo";
import { cn } from "@/components/ui/cn";
import { useCrmStore } from "@/lib/crm/store";
import { queueLeads, queueOpps, queueAccounts } from "@/lib/crm/filters";
import { isLoadEligible } from "@/lib/crm/sequence-queries";
import { useMemo } from "react";

const NAV = [
  { to: "/home", label: "Home", icon: Home, badge: "queue" as const },
  { to: "/leads", label: "Leads", icon: Users, badge: "leads" as const },
  {
    to: "/sequences",
    label: "Sequences",
    icon: Mail,
    badge: "eligible" as const,
  },
  { to: "/accounts", label: "Accounts", icon: Building2, badge: "accounts" as const },
  {
    to: "/opportunities",
    label: "Opportunities",
    icon: Target,
    badge: "opps" as const,
  },
  { to: "/activities", label: "Activities", icon: ListTodo, badge: "tasks" as const },
  { to: "/analytics", label: "Analytics", icon: BarChart3, badge: null },
] as const;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const leads = useCrmStore((s) => s.leads);
  const opps = useCrmStore((s) => s.opportunities);
  const accounts = useCrmStore((s) => s.accounts);
  const activities = useCrmStore((s) => s.activities);

  const badges = useMemo(
    () => ({
      queue: queueLeads(leads).length + queueOpps(opps).length,
      leads: queueLeads(leads).length,
      eligible: leads.filter(isLoadEligible).length,
      accounts: queueAccounts(accounts).length,
      opps: queueOpps(opps).length,
      tasks: activities.filter(
        (a) => a.ownerId === "usr_you" && !a.completedAt && a.dueAt,
      ).length,
    }),
    [leads, opps, accounts, activities],
  );

  return (
    <aside className="flex h-full w-[15.5rem] flex-col bg-sidebar text-sidebar-fg">
      <Link
        to="/home"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-3.5 py-4 hover:bg-sidebar-hover/60"
      >
        <RivvetIcon className="size-9 shrink-0" alt="" />
        <div className="min-w-0">
          <RivvetWordmarkOnDark className="h-[18px] w-auto max-w-[128px]" />
          <p className="mt-0.5 font-mono text-[9px] tracking-[0.18em] text-bright-mint">
            CRM
          </p>
        </div>
      </Link>

      <p className="px-4 pb-2 font-mono text-[9px] tracking-[0.14em] text-sidebar-muted">
        REVENUE EXECUTION
      </p>

      <nav className="flex-1 space-y-0.5 px-2" aria-label="Primary">
        {NAV.map((item) => {
          const active =
            pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          const count =
            item.badge && item.badge in badges
              ? badges[item.badge as keyof typeof badges]
              : null;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-sidebar-hover text-white"
                  : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-sidebar-active" : "",
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {count != null && count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular",
                    active
                      ? "bg-bright-mint/15 text-bright-mint"
                      : "bg-white/5 text-sidebar-muted",
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-2">
        <Link
          to="/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium",
            pathname.startsWith("/settings")
              ? "bg-sidebar-hover text-white"
              : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg",
          )}
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
