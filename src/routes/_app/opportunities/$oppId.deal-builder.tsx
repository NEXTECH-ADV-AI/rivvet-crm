import { createFileRoute, Link, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/opportunities/$oppId/deal-builder")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/opportunities/$oppId",
      params: { oppId: params.oppId },
    });
  },
  component: () => (
    <p className="p-6 text-sm">
      Deal builder lives on the opportunity page.{" "}
      <Link to="/opportunities">Back</Link>
    </p>
  ),
});
