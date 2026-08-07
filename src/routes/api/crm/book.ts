/**
 * Public book hydrate for sibling/sandbox proxy (pre-DNS).
 * Returns LIVE data when service_role is present on this deploy.
 * Lock/remove after domain cutover + auth.
 */
import { createFileRoute } from "@tanstack/react-router";
import { hydrateCrmService } from "@/lib/crm/wire/hydrate-service.server";

export const Route = createFileRoute("/api/crm/book")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const book = await hydrateCrmService({ allowProxy: false });
          return Response.json(book, {
            headers: {
              "Cache-Control": "private, max-age=30",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "hydrate failed";
          return Response.json(
            { source: "mock", error: msg },
            { status: 500 },
          );
        }
      },
    },
  },
});
