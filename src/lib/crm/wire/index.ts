export { CrmQueryProvider } from "./query-provider";
export {
  useWireStatus,
  useLeadBook,
  useLeadsList,
  useLead,
  useRecordActivities,
  useNextAction,
  useSetNextAction,
  useLogTouch,
  useCompleteTask,
  useAccountsList,
  useAccount,
  useAccountsFunnel,
  useOpportunitiesList,
  useOpportunity,
  usePatchOpportunityStage,
  useCreateOpportunity,
  useOpportunityRecord,
  useSaveOpportunity,
  useCrmHydrate,
  useMissionLineage,
} from "./hooks";
export {
  getWireStatusFn,
  listLeadsFn,
  getBookFn,
  listAccountsFn,
  getAccountFn,
  getAccountsFunnelFn,
  listOpportunitiesFn,
  getOpportunityFn,
  patchOpportunityStageFn,
  hydrateCrmFn,
  getMissionLineageFn,
  completeTaskFn,
  logCallFn,
} from "./server-fns";
export type { RecordRef } from "./hooks";
export type { LineageInput, LineageServiceResult } from "./activity-service.server";
export type {
  CanonicalActivitiesResult,
  CanonicalActivity,
  DuplicateFlag,
  MissionChip,
  MissionLineageResult,
  TrialState,
  UnavailableResult,
} from "./mission-lineage-map";
