import { createServerFn } from "@tanstack/react-start";
import type { ListAccountsInput, ListLeadsInput } from "./types";

export const getWireStatusFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { wireStatusService } = await import("./lead-service.server");
    return wireStatusService();
  },
);

export const listLeadsFn = createServerFn({ method: "GET" })
  .validator((data: ListLeadsInput) => data)
  .handler(async ({ data }) => {
    const { listLeadsService } = await import("./lead-service.server");
    return listLeadsService(data ?? { view: "sequence_ready" });
  });

export const getBookFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getBookService } = await import("./lead-service.server");
  return getBookService();
});

export const patchLeadNextActionFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      gtmLeadId: string;
      nextAction: string | null;
      nextActionDue: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { patchLeadNextActionService } = await import(
      "./lead-service.server"
    );
    return patchLeadNextActionService(data);
  });

export const listAccountsFn = createServerFn({ method: "GET" })
  .validator((data: ListAccountsInput) => data ?? {})
  .handler(async ({ data }) => {
    const { listAccountsService } = await import("./account-service.server");
    return listAccountsService(data ?? {});
  });

export const getAccountFn = createServerFn({ method: "GET" })
  .validator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
    const { getAccountService } = await import("./account-service.server");
    return getAccountService(data.accountId);
  });

export const getAccountsFunnelFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getAccountsFunnelService } = await import(
      "./account-service.server"
    );
    return getAccountsFunnelService();
  },
);
