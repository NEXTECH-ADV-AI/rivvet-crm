import { createServerFn } from "@tanstack/react-start";
import { requireCrmSession } from "@/lib/auth/crm-session";
import type { ListAccountsInput, ListLeadsInput } from "./types";
import type { LostReason, OppStage } from "../types";
import { parseCreateOpportunity } from "../opportunity-create";
import { parseOpportunitySave } from "../opportunity-form";

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

export const createOpportunityFn = createServerFn({ method: "POST" }).middleware([requireCrmSession])
  .validator((data: unknown) => parseCreateOpportunity(data))
  .handler(async ({ data, context }) => {
    const { createOpportunityService } = await import("./opportunity-create.server");
    return createOpportunityService(data, context.crmUser.email);
  });

export const hydrateCrmFn =createServerFn({ method: "GET" }).middleware([requireCrmSession]).handler(
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

type TargetInput = { gtmLeadId?: string | null; accountId?: string | null; opportunityId?: string | null };

/** Exactly one of gtmLeadId / accountId / opportunityId, a uuid: these ids go into PostgREST paths. */
function target(data: TargetInput) {
  const keys = (["gtmLeadId", "accountId", "opportunityId"] as const).filter((k) => data?.[k]);
  if (keys.length !== 1) throw new Error("Pick one lead, account or opportunity");
  const id = String(data[keys[0]]);
  if (!UUID.test(id)) throw new Error("Invalid record id");
  return { [keys[0]]: id } as { gtmLeadId?: string; accountId?: string; opportunityId?: string };
}

export const getLeadFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator((data: { leadId: string }) => ({ leadId: String(data?.leadId ?? "").slice(0, 40) }))
  .handler(async ({ data }) => {
    const { getLeadService } = await import("./record-service.server");
    return getLeadService(data.leadId);
  });

export const getRecordActivitiesFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator((data: TargetInput & { routeId: string }) => ({
    target: target(data),
    routeId: String(data?.routeId ?? "").slice(0, 60),
  }))
  .handler(async ({ data }) => {
    const { getRecordActivitiesService } = await import("./record-service.server");
    return getRecordActivitiesService(data.target, data.routeId);
  });

export const getNextActionFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator((data: TargetInput) => target(data))
  .handler(async ({ data }) => {
    const { getNextActionService } = await import("./record-service.server");
    return getNextActionService(data);
  });

export const setNextActionFn = createServerFn({ method: "POST" }).middleware([requireCrmSession])
  .validator((data: TargetInput & { title: string | null; dueDate: string | null }) => ({
    target: target(data),
    title: data.title == null ? null : String(data.title).slice(0, 200),
    dueDate: data.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(data.dueDate) ? data.dueDate : null,
  }))
  .handler(async ({ data }) => {
    const { setNextActionService } = await import("./record-service.server");
    return setNextActionService(data.target, data);
  });

export const logTouchFn = createServerFn({ method: "POST" }).middleware([requireCrmSession])
  .validator((data: TargetInput & { type: string; note?: string }) => {
    if (data?.type !== "call" && data?.type !== "email" && data?.type !== "note") throw new Error("Unknown log type");
    const note = String(data.note ?? "").trim().slice(0, 2000);
    if (data.type === "note" && !note) throw new Error("Write the note first");
    return { target: target(data), type: data.type as "call" | "email" | "note", note };
  })
  .handler(async ({ data, context }) => {
    const { logTouchService } = await import("./record-service.server");
    return logTouchService(data.target, { type: data.type, note: data.note, repEmail: context.crmUser.email });
  });

export const getOpportunityRecordFn = createServerFn({ method: "GET" }).middleware([requireCrmSession])
  .validator((data: { opportunityId: string }) => {
    if (!UUID.test(String(data?.opportunityId))) throw new Error("Invalid opportunity id");
    return { opportunityId: data.opportunityId };
  })
  .handler(async ({ data }) => {
    const { getOpportunityRecordService } = await import("./record-service.server");
    return getOpportunityRecordService(data.opportunityId);
  });

export const saveOpportunityFn = createServerFn({ method: "POST" }).middleware([requireCrmSession])
  .validator((data: unknown) => parseOpportunitySave(data))
  .handler(async ({ data }) => {
    const { saveOpportunityService } = await import("./record-service.server");
    return saveOpportunityService(data.opportunityId, data.form);
  });
