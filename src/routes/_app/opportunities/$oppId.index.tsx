import { createFileRoute, Link } from "@tanstack/react-router";
import { OppWorkspace } from "@/components/crm/opp-workspace";
import { useOpportunityRecord } from "@/lib/crm/wire";

export const Route = createFileRoute("/_app/opportunities/$oppId/")({
  component: OppDetail,
});

/** Loads by id from the database, so a pasted link opens before the rest of the app loads (RIV-1558). */
function OppDetail() {
  const { oppId } = Route.useParams();
  const q = useOpportunityRecord(oppId);
  if (q.isLoading) return <p className="p-6 text-sm text-fg-muted">Loading the opportunity…</p>;
  if (q.isError || !q.data?.record) {
    return (
      <div className="p-6 text-sm text-fg-muted">
        <p>{q.isError ? "Couldn't load this opportunity. Refresh to try again." : "This opportunity doesn't exist."}</p>
        <Link to="/opportunities" className="mt-2 inline-block font-semibold text-ink underline">
          Back to Opportunities
        </Link>
      </div>
    );
  }
  return <OppWorkspace key={oppId} record={q.data.record} />;
}
