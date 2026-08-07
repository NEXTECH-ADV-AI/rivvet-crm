import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAccountFn,
  getAccountsFunnelFn,
  getBookFn,
  getWireStatusFn,
  listAccountsFn,
  listLeadsFn,
  patchLeadNextActionFn,
} from "./server-fns";
import type { ListAccountsInput, ListLeadsInput } from "./types";
import { DEFAULT_PAGE_LIMIT } from "../sequence-queries";

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
    queryFn: () =>
      getAccountFn({ data: { accountId: accountId! } }),
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
