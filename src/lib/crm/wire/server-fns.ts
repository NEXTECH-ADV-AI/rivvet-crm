import { createServerFn } from "@tanstack/react-start";
import { requireCrmSession } from "@/lib/auth/crm-session";
import type { ListAccountsInput, ListLeadsInput } from "./types";
import type { LostReason, OppStage } from "../types";

export const getWireStatusFn = createServerFn({ method: "GET" }).middleware([requireCrmSession]).handler(
  async () => {
    const { wireStatusService } = await import("./lead-service.server");
    return wireStatusService();
  },
);

export const listLeadsFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator((data: ListLeadsInput) => data)
  .handler(async ({ data }) => {
    const { listLeadsService } = await import("./lead-service.server");
    return listLeadsService(data ?? { view: "sequence_ready" });
  });

export const getBookFn = createServerFn({ method: "GET" }).middleware([requireCrmSession]).handler(async () => {
  const { getBookService } = await import("./lead-service.server");
  return getBookService();
});

export const listAccountsFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator((data: ListAccountsInput) => data ?? {})
  .handler(async ({ data }) => {
    const { listAccountsService } = await import("./account-service.server");
    return listAccountsService(data ?? {});
  });

export const getAccountFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
    const { getAccountService } = await import("./account-service.server");
    return getAccountService(data.accountId);
  });

export const getAccountsFunnelFn = createServerFn({ method: "GET" }).middleware([requireCrmSession]).handler(
  async () => {
    const { getAccountsFunnelService } = await import(
      "./account-service.server"
    );
    return getAccountsFunnelService();
  },
);

export const listOpportunitiesFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator(
    (data: {
      view?: string;
      query?: string;
      stage?: string;
      owner?: string;
      limit?: number;
      offset?: number;
    }) => data ?? {},
  )
  .handler(async ({ data }) => {
    const { listOpportunitiesService } = await import(
      "./opportunity-service.server"
    );
    return listOpportunitiesService(data ?? {});
  });

export const getOpportunityFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator((data: { opportunityId: string }) => data)
  .handler(async ({ data }) => {
    const { getOpportunityService } = await import(
      "./opportunity-service.server"
    );
    return getOpportunityService(data.opportunityId);
  });

export const patchOpportunityStageFn = createServerFn({ method: "POST" }).middleware([requireCrmSession])
  .validator(
    (data: {
      opportunityId: string;
      stage: OppStage;
      lostReason?: LostReason | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { patchOpportunityStageService } = await import(
      "./opportunity-service.server"
    );
    return patchOpportunityStageService(data);
  });

export const hydrateCrmFn = createServerFn({ method: "GET" }).middleware([requireCrmSession]).handler(
  async () => {
    const { hydrateCrmService } = await import("./hydrate-service.server");
    return hydrateCrmService();
  },
);

export const getMissionLineageFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator(
    (data: {
      accountId?: string | null;
      gtmLeadId?: string | null;
      clientId?: string | null;
    }) => data ?? {},
  )
  .handler(async ({ data }) => {
    const { getMissionLineageService } = await import(
      "./activity-service.server"
    );
    return getMissionLineageService(data ?? {});
  });

export const completeTaskFn = createServerFn({ method: "POST" }).middleware([requireCrmSession])
  .validator((data: { taskId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(String(data?.taskId))) throw new Error("Invalid task id");
    return { taskId: data.taskId };
  })
  .handler(async ({ data }) => {
    const { restPatch } = await import("./supabase-rest.server");
    const now = new Date().toISOString();
    await restPatch(
      "/crm_tasks",
      { task_id: `eq.${data.taskId}`, status: "eq.open" },
      { status: "completed", completed_at: now, updated_at: now },
    );
    return { ok: true as const };
  });

export const logCallFn = createServerFn({ method: "POST" }).middleware([requireCrmSession])
  .validator((data: { gtmLeadId: string; outcome: string; note?: string; callbackAt?: string | null }) => {
    if (!/^[0-9a-f-]{36}$/i.test(String(data?.gtmLeadId))) throw new Error("Invalid lead id");
    return {
      gtmLeadId: data.gtmLeadId,
      outcome: String(data.outcome),
      note: String(data.note ?? "").slice(0, 2000),
      callbackAt: data.callbackAt && !Number.isNaN(Date.parse(data.callbackAt)) ? new Date(data.callbackAt).toISOString() : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { logCallService } = await import("./call-service.server");
    return logCallService({ ...data, repEmail: context.crmUser.email });
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Exactly one of gtmLeadId / accountId, each a uuid: these ids go into PostgREST paths. */
function target(data: { gtmLeadId?: string | null; accountId?: string | null }) {
  const gtmLeadId = data?.gtmLeadId ? String(data.gtmLeadId) : undefined;
  const accountId = data?.accountId ? String(data.accountId) : undefined;
  if (Boolean(gtmLeadId) === Boolean(accountId)) throw new Error("Pick one lead or one account");
  if (!UUID.test(gtmLeadId ?? accountId ?? "")) throw new Error("Invalid record id");
  return gtmLeadId ? { gtmLeadId } : { accountId };
}

export const getLeadFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator((data: { leadId: string }) => ({ leadId: String(data?.leadId ?? "").slice(0, 40) }))
  .handler(async ({ data }) => {
    const { getLeadService } = await import("./record-service.server");
    return getLeadService(data.leadId);
  });

export const getRecordActivitiesFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator((data: { gtmLeadId?: string; accountId?: string; routeId: string }) => ({
    target: target(data),
    routeId: String(data?.routeId ?? "").slice(0, 60),
  }))
  .handler(async ({ data }) => {
    const { getRecordActivitiesService } = await import("./record-service.server");
    return getRecordActivitiesService(data.target, data.routeId);
  });

export const getNextActionFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator((data: { gtmLeadId?: string; accountId?: string }) => target(data))
  .handler(async ({ data }) => {
    const { getNextActionService } = await import("./record-service.server");
    return getNextActionService(data);
  });

export const setNextActionFn = createServerFn({ method: "POST" }).middleware([requireCrmSession])
  .validator((data: { gtmLeadId?: string; accountId?: string; title: string | null; dueDate: string | null }) => ({
    target: target(data),
    title: data.title == null ? null : String(data.title).slice(0, 200),
    dueDate: data.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(data.dueDate) ? data.dueDate : null,
  }))
  .handler(async ({ data }) => {
    const { setNextActionService } = await import("./record-service.server");
    return setNextActionService(data.target, data);
  });

export const logTouchFn = createServerFn({ method: "POST" }).middleware([requireCrmSession])
  .validator((data: { gtmLeadId?: string; accountId?: string; type: string; note?: string }) => {
    if (data?.type !== "call" && data?.type !== "email") throw new Error("Unknown log type");
    return { target: target(data), type: data.type as "call" | "email", note: String(data.note ?? "").slice(0, 2000) };
  })
  .handler(async ({ data, context }) => {
    const { logTouchService } = await import("./record-service.server");
    return logTouchService(data.target, { type: data.type, note: data.note, repEmail: context.crmUser.email });
  });
