import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBookFn,
  getWireStatusFn,
  listLeadsFn,
  patchLeadNextActionFn,
} from "./server-fns";
import type { ListLeadsInput } from "./types";
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
