import { useMemo } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { OppWorkspace } from "@/components/crm/opp-workspace";
import { useCrmStore } from "@/lib/crm/store";

export const Route = createFileRoute("/_app/opportunities/$oppId/")({
  component: OppDetail,
});

function OppDetail() {
  const { oppId } = Route.useParams();
  const opportunities = useCrmStore((s) => s.opportunities);
  const opp = useMemo(
    () => opportunities.find((o) => o.id === oppId),
    [opportunities, oppId],
  );
  if (!opp) throw notFound();
  return <OppWorkspace oppId={oppId} />;
}
