import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Building2, Target, ListTodo, BarChart3, Settings } from "lucide-react";
import { RivvetBrand } from "./logo";
import { cn } from "@/components/ui/cn";
import { useCrmStore } from "@/lib/crm/store";
import { queueAccounts } from "@/lib/crm/filters";
import { useLeadsList } from "@/lib/crm/wire";
import { useMemo } from "react";

const NAV = [
  { to: "/home", label: "Home", icon: Home, badge: null },
  { to: "/leads", label: "Leads", icon: Users, badge: "calls" as const },
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
  // Same query as Home's call queue card, so it shares the cache.
  const callQ = useLeadsList({ view: "call_queue", limit: 1, offset: 0 });
  const calls = callQ.data?.total ?? 0;
  const opps = useCrmStore((s) => s.opportunities);
  const accounts = useCrmStore((s) => s.accounts);
  const activities = useCrmStore((s) => s.activities);

  const badges = useMemo(
    () => ({
      calls,
      accounts: queueAccounts(accounts).length,
      // The same number the Opportunities page opens on ("All"), so the two never disagree.
      opps: opps.length,
      tasks: activities.filter((a) => a.type === "task" && !a.completedAt).length,
    }),
    [calls, opps, accounts, activities],
  );

  return (
    <aside className="flex h-full min-h-0 w-full md:w-56 flex-col bg-sidebar text-sidebar-fg">
      <Link
        to="/home"
        onClick={onNavigate}
        className="flex shrink-0 items-center gap-3 px-5 py-6 hover:bg-white/6"
      >
        <div className="min-w-0">
          <RivvetBrand variant="dark" className="max-w-[140px]" />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">CRM</p>
        </div>
      </Link>

      <nav
        className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3"
        aria-label="Primary"
      >
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          const count =
            item.badge && item.badge in badges ? badges[item.badge as keyof typeof badges] : null;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] md:text-[14px] font-medium transition-colors",
                active
                  ? "bg-white/12 text-white"
                  : "text-white/70 hover:bg-white/6 hover:text-white",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-active" : "")} />
              <span className="flex-1 truncate">{item.label}</span>
              {count != null && count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular",
                    active ? "bg-bright-mint/15 text-bright-mint" : "bg-white/5 text-sidebar-muted",
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Link
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          to="/settings"
          onClick={onNavigate}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] md:text-[14px] font-medium",
            pathname.startsWith("/settings")
              ? "bg-white/12 text-white"
              : "text-white/70 hover:bg-white/6 hover:text-white",
          )}
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
