import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/crm/app-shell";
import { CrmQueryProvider } from "@/lib/crm/wire";

export const Route = createFileRoute("/_app")({
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
