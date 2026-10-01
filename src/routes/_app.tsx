import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/crm/app-shell";
import { CrmQueryProvider } from "@/lib/crm/wire";
import { getCrmUserFn } from "@/lib/auth/crm-session";

export const Route = createFileRoute("/_app")({
  // Every CRM page requires a Rivvet session (RIV-1534). Runs on the server for
  // the first load and on every client navigation.
  beforeLoad: async () => {
    const user = await getCrmUserFn();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <CrmQueryProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </CrmQueryProvider>
  );
}
