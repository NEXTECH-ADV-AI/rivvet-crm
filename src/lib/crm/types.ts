/**
 * Domain types for Rivvet CRM (crm.rivvetai.com).
 * Production CRM only — not ops/command.
 */

import type { DealDraft } from "./deal-catalog";

export type OwnerId = "usr_you" | "usr_maya" | "usr_jordan" | "unassigned";

export type Priority = "P1" | "P2" | "P3";

export interface PriorityResult {
  priority: Priority;
  reasons: string[];
}

export type OppStage =
  | "qualified"
  | "demo_booked"
  | "demo_held"
  | "proposal_out"
  | "closed_won"
  | "closed_lost";

export type LostReason = "no-show" | "no-fit" | "price" | "timing";

export type Vertical =
  | "hvac"
  | "plumbing"
  | "pool"
  | "cleaning"
  | "landscaping"
  | "pest"
  | "electrical"
  | "roofing"
  | "dental"
  | "fleet"
  | "logistics"
  | "field_service"
  | "commerce"
  | "other";

export type LeadLifecycle =
  | "scraped"
  | "enriched"
  | "enrich_failed"
  | "verified"
  | "verification_failed"
  | "loaded_to_instantly"
  | "inbound_callback"
  | "qualified_discovery"
  | "demo_booked"
  | "demo_held"
  | "proposal_out"
  | "closed_won"
  | "closed_lost"
  | "nurture"
  | "disqualified";

export type EnrichmentStatus = "none" | "partial" | "complete" | "failed";

export type EmailVerificationStatus =
  | "valid"
  | "invalid"
  | "pending"
  | "risky"
  | "unknown";

export type IcpTier = "A" | "B" | "C" | "D";

export type ScoreIntent = "high" | "med" | "low";

export type ListView =
  | "all"
  | "ready"
  | "sequence_ready"
  | "load_eligible"
  | "needs_enrich"
  | "needs_verify"
  | "enrich_backlog"
  | "unverified"
  | "in_instantly"
  | "high_icp"
  | "mine"
  | "my_open"
  | "stale"
  | "stale_7d"
  | "closing_month";

export type ForecastCategory =
  | "pipeline"
  | "best_case"
  | "commit"
  | "omitted"
  | "closed";

export type LockedSendState =
  | "none"
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "void";

export type LockedPaymentState = "none" | "pending" | "paid" | "failed";

export interface IcpBreakdown {
  industryFit: number;
  sizeFit: number;
  geoFit: number;
  techFit: number;
  budgetSignal: number;
}

export interface Lead {
  id: string;
  gtmLeadId?: string;
  externalRef?: string;
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string | null;
  websiteUrl: string | null;
  lifecycle: LeadLifecycle;
  status: LeadLifecycle;
  ownerId: OwnerId;
  source: string;
  sourceDetail: string | null;
  vertical: Vertical;
  enrichmentStatus: EnrichmentStatus;
  emailVerificationStatus: EmailVerificationStatus;
  ownerVerified: boolean;
  icpScore: number;
  icpTier: IcpTier;
  icp: IcpBreakdown;
  employeeBand: string | null;
  region: string;
  city: string | null;
  state: string | null;
  scoreIntent: ScoreIntent;
  nextAction: string | null;
  nextActionDue: string | null;
  nextCallbackAt?: string | null;
  humanCallAttempts?: number;
  lastHumanCallAt?: string | null;
  emailOpened: boolean;
  emailReplied: boolean;
  dncFlag: boolean;
  marketingPaused: boolean;
  instantlyCampaignId: string | null;
  instantlyCampaignName: string | null;
  opportunityCreated?: boolean;
  demoBookedAt?: string | null;
  lastTouch: string;
  createdAt: string;
  updatedAt: string;
  amountHint: number | null;
  accountId: string | null;
  convertedOppId: string | null;
  tags: string[];
  enrichedAt: string | null;
  scrapeBatch: string | null;
}

export interface LeadBookSnapshot {
  total: number;
  validEmail: number;
  sequenceReady: number;
  inInstantly: number;
  enriched?: number;
  ownerVerified?: number;
  icpA?: number;
  icpB?: number;
  workable?: number;
  hvacSharePct: number;
  statesInLoads: number;
  byLifecycle: Partial<Record<LeadLifecycle | string, number>>;
  byVertical: Partial<Record<Vertical, number>>;
  byCampaignLoads: Record<string, number>;
  asOf: string;
  notes: string;
}

export type AccountStatus =
  | "prospect"
  | "active"
  | "at_risk"
  | "churned"
  | "customer";
export type AccountHealth = "healthy" | "watch" | "risk";

export interface Account {
  id: string;
  name: string;
  domain: string | null;
  industry: string;
  status: AccountStatus;
  ownerId: OwnerId;
  arr: number;
  billingEmail: string | null;
  nextAction: string | null;
  nextActionDue: string | null;
  lastTouch: string;
  health: AccountHealth;
  openOpps: number;
  createdAt: string;
  updatedAt: string;
  employeeBand: string | null;
  region: string;
  tags: string[];
}

export interface Contact {
  id: string;
  accountId: string;
  leadId: string | null;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string | null;
  isPrimary: boolean;
  ownerId: OwnerId;
  createdAt: string;
  updatedAt: string;
}

export type DealConfig = DealDraft;

export interface Opportunity {
  id: string;
  gtmLeadId: string | null;
  name: string;
  accountId: string | null;
  accountName: string;
  primaryContactId: string | null;
  stage: OppStage;
  amount: number;
  monthlyAmount: number | null;
  currency: string;
  ownerId: OwnerId;
  closeDate: string | null;
  nextAction: string | null;
  nextActionDue: string | null;
  lastTouch: string;
  stageEnteredAt: string;
  probability: number;
  forecastCategory: ForecastCategory;
  vertical: Vertical;
  region: string;
  notes: string;
  source: string;
  engagement: { opened: number | null; replied: number; calls: number };
  deal: DealConfig;
  lockedSendState?: LockedSendState;
  lockedPaymentState?: LockedPaymentState;
  pandadocDocumentId?: string | null;
  stripeCheckoutId?: string | null;
  packageSku: string | null;
  createdAt: string;
  updatedAt: string;
  sourceLeadId: string | null;
  tags: string[];
  scorePriority: number;
  lostReason?: LostReason | null;
}

export type ActivityType =
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "system"
  | "task"
  | "stage_change";

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  body: string;
  relatedType: "lead" | "opportunity" | "account";
  relatedId: string;
  relatedName: string;
  ownerId: OwnerId;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  secondaryRelatedType?: "lead" | "opportunity" | "account";
  secondaryRelatedId?: string;
}

export interface StageEvent {
  id: string;
  opportunityId: string;
  fromStage: OppStage | null;
  toStage: OppStage;
  at: string;
  byUserId: OwnerId;
  note: string | null;
  lostReason?: LostReason | null;
}

export interface SendDocumentMirror {
  id: string;
  opportunityId: string;
  provider: "pandadoc";
  status: "draft" | "sent" | "viewed" | "signed" | "void";
  templateKey: string;
  recipientEmail: string;
  amount: number;
  createdAt: string;
  sentAt: string | null;
  signedAt: string | null;
  externalId: string;
}

export interface PaymentMirror {
  id: string;
  opportunityId: string;
  provider: "stripe";
  status: "pending" | "paid" | "failed";
  amount: number;
  externalId: string;
  createdAt: string;
  paidAt: string | null;
}

export interface CrmUser {
  id: OwnerId | string;
  displayName: string;
  email: string;
  role: "ae" | "admin" | "ops" | "manager";
  active: boolean;
}

export interface NextActionPatch {
  nextAction: string | null;
  nextActionDue: string | null;
}

export type OppPatch = Partial<
  Pick<
    Opportunity,
    | "name"
    | "amount"
    | "monthlyAmount"
    | "closeDate"
    | "nextAction"
    | "nextActionDue"
    | "notes"
    | "vertical"
    | "ownerId"
    | "lostReason"
    | "packageSku"
    | "forecastCategory"
    | "probability"
    | "region"
  >
>;
