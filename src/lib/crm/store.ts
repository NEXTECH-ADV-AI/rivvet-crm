import { create } from "zustand";
import {
  seedAccounts,
  seedActivities,
  seedContacts,
  seedLeads,
  seedOpportunities,
  seedPayments,
  seedSendDocuments,
  seedStageEvents,
  DEMO_NOW,
} from "./seed";
import type {
  Activity,
  NextActionPatch,
  OwnerId,
  PaymentMirror,
  SendDocumentMirror,
  StageEvent,
  Account,
  Contact,
  Lead,
  Opportunity,
  OppStage,
  OppPatch,
  DealConfig,
  LostReason,
  LeadLifecycle,
} from "./types";
import { STAGE_LABEL } from "./priority";
import { priceDeal } from "./deal-catalog";
import { PROD_OPP_STATUS_WRITE, PROD_LOST_REASONS } from "./prod-mirror";
import {
  INSTANTLY_CAMPAIGNS,
  isSequenceVertical,
  type SequenceVertical,
} from "./lead-model";
import {
  DEFAULT_GO_BATCH_SIZE,
  isLoadEligible,
} from "./sequence-queries";

export interface CrmState {
  leads: Lead[];
  accounts: Account[];
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
  stageEvents: StageEvent[];
  sendDocuments: SendDocumentMirror[];
  payments: PaymentMirror[];
  currentUserId: OwnerId;
  lastLoadGo: {
    vertical: SequenceVertical;
    count: number;
    at: string;
    leadIds: string[];
  } | null;
  /** mock | live after hydrate */
  dataSource: "mock" | "live" | "seed";
  hydrateMessage: string | null;
  hydratedAt: string | null;

  hydrateFromWire: (payload: {
    source: "mock" | "live";
    leads: Lead[];
    accounts: Account[];
    opportunities: Opportunity[];
    contacts: Contact[];
    activities: Activity[];
    message: string;
  }) => void;
  setLeadNextAction: (id: string, patch: NextActionPatch) => void;
  setAccountNextAction: (id: string, patch: NextActionPatch) => void;
  setOppNextAction: (id: string, patch: NextActionPatch) => void;
  patchOpp: (id: string, patch: OppPatch) => void;
  setDealConfig: (id: string, deal: Partial<DealConfig>) => void;
  moveOppStage: (
    id: string,
    toStage: OppStage,
    lostReason?: LostReason | null,
  ) => void;
  completeActivity: (id: string) => void;
  addNote: (
    relatedType: Activity["relatedType"],
    relatedId: string,
    relatedName: string,
    subject: string,
    body: string,
  ) => void;
  logTouch: (
    relatedType: "lead" | "account" | "opportunity",
    relatedId: string,
    relatedName: string,
    type: "call" | "email" | "meeting",
    subject: string,
  ) => void;
  simulateLoadGo: (
    vertical: SequenceVertical,
    max?: number,
  ) => { ok: boolean; message: string; count: number };
}

function touchNow() {
  return new Date(DEMO_NOW).toISOString();
}

const STAGE_PROB: Record<OppStage, number> = {
  qualified: 20,
  demo_booked: 40,
  demo_held: 60,
  proposal_out: 80,
  closed_won: 100,
  closed_lost: 0,
};

let seq = 900;
let stageSeq = 100;

export const useCrmStore = create<CrmState>((set, get) => ({
  leads: structuredClone(seedLeads),
  accounts: structuredClone(seedAccounts),
  contacts: structuredClone(seedContacts),
  opportunities: structuredClone(seedOpportunities),
  activities: structuredClone(seedActivities),
  stageEvents: structuredClone(seedStageEvents),
  sendDocuments: structuredClone(seedSendDocuments),
  payments: structuredClone(seedPayments),
  currentUserId: "usr_you",
  lastLoadGo: null,
  dataSource: "seed",
  hydrateMessage: null,
  hydratedAt: null,

  hydrateFromWire: (payload) => {
    set({
      leads: payload.leads.length ? payload.leads : get().leads,
      accounts: payload.accounts.length ? payload.accounts : get().accounts,
      opportunities: payload.opportunities.length
        ? payload.opportunities
        : get().opportunities,
      contacts: payload.contacts.length ? payload.contacts : get().contacts,
      activities: payload.activities.length
        ? payload.activities
        : get().activities,
      dataSource: payload.source,
      hydrateMessage: payload.message,
      hydratedAt: new Date().toISOString(),
    });
  },

  setLeadNextAction: (id, patch) => {
    set((s) => ({
      leads: s.leads.map((l) =>
        l.id === id
          ? { ...l, ...patch, updatedAt: touchNow(), lastTouch: touchNow() }
          : l,
      ),
      activities: [
        {
          id: `T-${++seq}`,
          type: "system" as const,
          subject: patch.nextAction
            ? `Next step set: ${patch.nextAction}`
            : "Next step cleared",
          body: "Local mutation — mirrors gtm_leads next_action fields.",
          relatedType: "lead" as const,
          relatedId: id,
          relatedName: s.leads.find((l) => l.id === id)?.name ?? id,
          ownerId: s.currentUserId,
          dueAt: patch.nextActionDue,
          completedAt: touchNow(),
          createdAt: touchNow(),
        },
        ...s.activities,
      ],
    }));
  },

  setAccountNextAction: (id, patch) => {
    set((s) => ({
      accounts: s.accounts.map((a) =>
        a.id === id
          ? { ...a, ...patch, updatedAt: touchNow(), lastTouch: touchNow() }
          : a,
      ),
    }));
  },

  setOppNextAction: (id, patch) => {
    set((s) => ({
      opportunities: s.opportunities.map((o) =>
        o.id === id
          ? { ...o, ...patch, updatedAt: touchNow(), lastTouch: touchNow() }
          : o,
      ),
    }));
  },

  patchOpp: (id, patch) => {
    set((s) => ({
      opportunities: s.opportunities.map((o) =>
        o.id === id
          ? { ...o, ...patch, updatedAt: touchNow(), lastTouch: touchNow() }
          : o,
      ),
    }));
  },

  setDealConfig: (id, dealPatch) => {
    set((s) => ({
      opportunities: s.opportunities.map((o) => {
        if (o.id !== id) return o;
        const deal = { ...o.deal, ...dealPatch };
        const priced = priceDeal(deal);
        return {
          ...o,
          deal,
          packageSku:
            priced.mode === "service"
              ? priced.product?.sku ?? null
              : "commerce_partnership_order",
          monthlyAmount: priced.monthly,
          amount: priced.tcv,
          updatedAt: touchNow(),
        };
      }),
    }));
  },

  moveOppStage: (id, toStage, lostReason = null) => {
    const s = get();
    const opp = s.opportunities.find((o) => o.id === id);
    if (!opp || opp.stage === toStage) return;

    if (toStage === "closed_lost") {
      if (
        !lostReason ||
        !(PROD_LOST_REASONS as readonly string[]).includes(lostReason)
      ) {
        return;
      }
    }

    const fromStage = opp.stage;
    const now = touchNow();
    set((state) => ({
      opportunities: state.opportunities.map((o) =>
        o.id === id
          ? {
              ...o,
              stage: toStage,
              probability: STAGE_PROB[toStage],
              lostReason: toStage === "closed_lost" ? lostReason : null,
              stageEnteredAt: now,
              updatedAt: now,
              lastTouch: now,
            }
          : o,
      ),
      stageEvents: [
        {
          id: `SE-${++stageSeq}`,
          opportunityId: id,
          fromStage,
          toStage,
          at: now,
          byUserId: state.currentUserId,
          note: `→ ${STAGE_LABEL[toStage] ?? toStage}${
            toStage === "closed_lost" && lostReason ? ` (${lostReason})` : ""
          }`,
          lostReason: toStage === "closed_lost" ? lostReason : null,
        },
        ...state.stageEvents,
      ],
      activities: [
        {
          id: `T-${++seq}`,
          type: "stage_change" as const,
          subject: `Stage → ${STAGE_LABEL[toStage] ?? toStage}`,
          body: `Pipeline move from ${STAGE_LABEL[fromStage] ?? fromStage}. Status write target: ${PROD_OPP_STATUS_WRITE[toStage]}.`,
          relatedType: "opportunity" as const,
          relatedId: id,
          relatedName: opp.name,
          ownerId: state.currentUserId,
          dueAt: null,
          completedAt: now,
          createdAt: now,
        },
        ...state.activities,
      ],
      leads:
        opp.gtmLeadId || opp.sourceLeadId
          ? state.leads.map((l) =>
              l.id === opp.gtmLeadId ||
              l.id === opp.sourceLeadId ||
              l.gtmLeadId === opp.gtmLeadId
                ? {
                    ...l,
                    lifecycle: (PROD_OPP_STATUS_WRITE[toStage] as LeadLifecycle) ||
                      l.lifecycle,
                    status:
                      (PROD_OPP_STATUS_WRITE[toStage] as LeadLifecycle) ||
                      l.status,
                    updatedAt: now,
                    lastTouch: now,
                  }
                : l,
            )
          : state.leads,
    }));
  },

  completeActivity: (id) => {
    set((s) => ({
      activities: s.activities.map((a) =>
        a.id === id ? { ...a, completedAt: touchNow() } : a,
      ),
    }));
  },

  addNote: (relatedType, relatedId, relatedName, subject, body) => {
    set((s) => ({
      activities: [
        {
          id: `T-${++seq}`,
          type: "note" as const,
          subject,
          body,
          relatedType,
          relatedId,
          relatedName,
          ownerId: s.currentUserId,
          dueAt: null,
          completedAt: touchNow(),
          createdAt: touchNow(),
        },
        ...s.activities,
      ],
    }));
  },

  logTouch: (relatedType, relatedId, relatedName, type, subject) => {
    const now = touchNow();
    set((s) => {
      const base = {
        id: `T-${++seq}`,
        type,
        subject,
        body: "Logged from CRM UI",
        relatedType,
        relatedId,
        relatedName,
        ownerId: s.currentUserId,
        dueAt: null,
        completedAt: now,
        createdAt: now,
      } as Activity;
      return {
        activities: [base, ...s.activities],
        leads:
          relatedType === "lead"
            ? s.leads.map((l) =>
                l.id === relatedId
                  ? {
                      ...l,
                      lastTouch: now,
                      lastHumanCallAt: type === "call" ? now : l.lastHumanCallAt,
                      humanCallAttempts:
                        type === "call"
                          ? (l.humanCallAttempts ?? 0) + 1
                          : l.humanCallAttempts,
                      updatedAt: now,
                    }
                  : l,
              )
            : s.leads,
        accounts:
          relatedType === "account"
            ? s.accounts.map((a) =>
                a.id === relatedId
                  ? { ...a, lastTouch: now, updatedAt: now }
                  : a,
              )
            : s.accounts,
        opportunities:
          relatedType === "opportunity"
            ? s.opportunities.map((o) =>
                o.id === relatedId
                  ? { ...o, lastTouch: now, updatedAt: now }
                  : o,
              )
            : s.opportunities,
      };
    });
  },

  simulateLoadGo: (vertical, max = DEFAULT_GO_BATCH_SIZE) => {
    const s = get();
    if (!isSequenceVertical(vertical)) {
      return { ok: false, message: "Vertical not sequence-enabled", count: 0 };
    }
    const camp = INSTANTLY_CAMPAIGNS[vertical];
    const eligible = s.leads
      .filter((l) => isLoadEligible(l) && l.vertical === vertical)
      .slice(0, max);
    if (!eligible.length) {
      return {
        ok: false,
        message: `No load-eligible ${vertical} leads in book`,
        count: 0,
      };
    }
    const now = touchNow();
    const ids = new Set(eligible.map((l) => l.id));
    set({
      leads: s.leads.map((l) =>
        ids.has(l.id)
          ? {
              ...l,
              lifecycle: "loaded_to_instantly" as const,
              status: "loaded_to_instantly" as const,
              instantlyCampaignId: camp.id,
              instantlyCampaignName: camp.name,
              updatedAt: now,
              lastTouch: now,
            }
          : l,
      ),
      lastLoadGo: {
        vertical,
        count: eligible.length,
        at: now,
        leadIds: eligible.map((l) => l.id),
      },
    });
    return {
      ok: true,
      message: `Simulated Load GO · ${eligible.length} → ${camp.name}`,
      count: eligible.length,
    };
  },
}));
