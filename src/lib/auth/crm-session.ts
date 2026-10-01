import { createMiddleware, createServerFn } from "@tanstack/react-start";

/** Every CRM server function runs behind this: no Rivvet session, no data (RIV-1534). */
export const requireCrmSession = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { readCrmSession } = await import("./crm-session.server");
    const session = readCrmSession();
    if (!session) throw new Error("Unauthorized");
    return next({ context: { crmUser: session } });
  },
);

export const getCrmUserFn = createServerFn({ method: "GET" }).handler(async () => {
  const { readCrmSession } = await import("./crm-session.server");
  return readCrmSession();
});

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { endCrmSession } = await import("./crm-session.server");
  endCrmSession();
  return { ok: true as const };
});
