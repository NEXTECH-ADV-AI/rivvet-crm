import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAccountFn,
  getAccountsFunnelFn,
  getBookFn,
  getOpportunityFn,
  getWireStatusFn,
  hydrateCrmFn,
  listAccountsFn,
  listLeadsFn,
  listOpportunitiesFn,
  patchLeadNextActionFn,
  patchOpportunityStageFn,
} from "./server-fns";
import type { ListAccountsInput, ListLeadsInput } from "./types";
import type { LostReason, OppStage } from "../types";
import { DEFAULT_PAGE_LIMIT } from "../sequence-queries";
import { useCrmStore } from "../store";
import { useEffect } from "react";

export function useWireStatus() {
  return useQuery({
    queryKey: ["crm", "wire-status"],
    queryFn: () => getWireStatusFn(),
    staleTime: 30_000,
  });
}

export function useLeadBook() {
  return useQuery({
    queryKey: ["crm", "book"],
    queryFn: () => getBookFn(),
    staleTime: 60_000,
  });
}

export function useLeadsList(input: ListLeadsInput) {
  const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
  const offset = input.offset ?? 0;
  return useQuery({
    queryKey: ["crm", "leads", { ...input, limit, offset }],
    queryFn: () =>
      listLeadsFn({
        data: { ...input, limit, offset },
      }),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function usePatchLeadNextAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      gtmLeadId: string;
      nextAction: string | null;
      nextActionDue: string | null;
    }) => patchLeadNextActionFn({ data: vars }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      void qc.invalidateQueries({ queryKey: ["crm", "hydrate"] });
    },
  });
}

export function useAccountsList(input: ListAccountsInput = {}) {
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  return useQuery({
    queryKey: ["crm", "accounts", { ...input, limit, offset }],
    queryFn: () =>
      listAccountsFn({
        data: { ...input, limit, offset },
      }),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function useAccount(accountId: string | undefined) {
  return useQuery({
    queryKey: ["crm", "account", accountId],
    queryFn: () => getAccountFn({ data: { accountId: accountId! } }),
    enabled: Boolean(accountId),
    staleTime: 15_000,
  });
}

export function useAccountsFunnel() {
  return useQuery({
    queryKey: ["crm", "accounts-funnel"],
    queryFn: () => getAccountsFunnelFn(),
    staleTime: 60_000,
  });
}

export function useOpportunitiesList(
  input: {
    view?: string;
    query?: string;
    stage?: string;
    owner?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  return useQuery({
    queryKey: ["crm", "opportunities", input],
    queryFn: () => listOpportunitiesFn({ data: input }),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function useOpportunity(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ["crm", "opportunity", opportunityId],
    queryFn: () =>
      getOpportunityFn({ data: { opportunityId: opportunityId! } }),
    enabled: Boolean(opportunityId),
    staleTime: 15_000,
  });
}

export function usePatchOpportunityStage() {
  const qc = useQueryClient();
  const moveOppStage = useCrmStore((s) => s.moveOppStage);
  return useMutation({
    mutationFn: async (vars: {
      opportunityId: string;
      stage: OppStage;
      lostReason?: LostReason | null;
    }) => {
      // Optimistic local update so the toggle feels instant
      moveOppStage(vars.opportunityId, vars.stage, vars.lostReason);
      const result = await patchOpportunityStageFn({ data: vars });
      if (!result.ok && result.source === "live") {
        throw new Error(result.message || "Stage update failed");
      }
      return result;
    },
    onSuccess: () => {
      // Refresh lists but keep optimistic stage (mapped again from server)
      void qc.invalidateQueries({ queryKey: ["crm", "opportunities"] });
      void qc.invalidateQueries({ queryKey: ["crm", "hydrate"] });
    },
    onError: (err) => {
      console.error("[crm] stage patch failed", err);
      // Force re-hydrate so UI snaps back to server truth
      void qc.invalidateQueries({ queryKey: ["crm", "hydrate"] });
    },
  });
}

/** Full-book hydrate into Zustand so Home / Kanban / Analytics stay functional E2E */
export function useCrmHydrate() {
  const hydrateFromWire = useCrmStore((s) => s.hydrateFromWire);
  const q = useQuery({
    queryKey: ["crm", "hydrate"],
    queryFn: () => hydrateCrmFn(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (q.data) {
      hydrateFromWire({
        source: q.data.source,
        leads: q.data.leads,
        accounts: q.data.accounts,
        opportunities: q.data.opportunities,
        contacts: q.data.contacts,
        activities: q.data.activities,
        message: q.data.message,
      });
    }
  }, [q.data, hydrateFromWire]);

  return q;
}
