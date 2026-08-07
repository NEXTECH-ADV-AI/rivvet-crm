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
  users,
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
  Vertical,
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
  /** last simulated GO log (sandbox) */
  lastLoadGo: {
    vertical: SequenceVertical;
    count: number;
    at: string;
    leadIds: string[];
  } | null;

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
  /**
   * Sandbox-only: mirrors Instantly Load GO for a single vertical.
   * Does NOT call Instantly/n8n. Max DEFAULT_GO_BATCH_SIZE.
   */
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
          body: "Local sandbox mutation — mirrors gtm_leads next_action fields.",
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
    get().patchOpp(id, patch);
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
              stageEnteredAt: now.slice(0, 10),
              probability: STAGE_PROB[toStage],
              lostReason: toStage === "closed_lost" ? lostReason : null,
              lastTouch: now,
              updatedAt: now,
            }
          : o,
      ),
      leads: state.leads.map((l) => {
        if (l.id !== opp.sourceLeadId && l.convertedOppId !== id) return l;
        const status = PROD_OPP_STATUS_WRITE[toStage] as Lead["lifecycle"];
        return {
          ...l,
          lifecycle: status,
          status,
          updatedAt: now,
          lastTouch: now,
        };
      }),
      stageEvents: [
        {
          id: `SE-${++stageSeq}`,
          opportunityId: id,
          fromStage,
          toStage,
          at: now,
          byUserId: state.currentUserId,
          note: "Stage change (sandbox only)",
          lostReason: toStage === "closed_lost" ? lostReason : null,
        },
        ...state.stageEvents,
      ],
      activities: [
        {
          id: `T-${++seq}`,
          type: "stage_change" as const,
          subject: `Stage → ${STAGE_LABEL[toStage] ?? toStage}`,
          body: `From ${STAGE_LABEL[fromStage] ?? fromStage}. Status write: ${PROD_OPP_STATUS_WRITE[toStage]}. Local only.`,
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
    const { currentUserId } = get();
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
          ownerId: currentUserId,
          dueAt: null,
          completedAt: touchNow(),
          createdAt: touchNow(),
        },
        ...s.activities,
      ],
    }));
  },

  logTouch: (relatedType, relatedId, relatedName, type, subject) => {
    const { currentUserId } = get();
    const now = touchNow();
    set((s) => {
      const activity: Activity = {
        id: `T-${++seq}`,
        type,
        subject,
        body: "Logged in sandbox (mirrors activities table).",
        relatedType,
        relatedId,
        relatedName,
        ownerId: currentUserId,
        dueAt: null,
        completedAt: now,
        createdAt: now,
      };
      const base = { lastTouch: now, updatedAt: now };
      return {
        activities: [activity, ...s.activities],
        leads:
          relatedType === "lead"
            ? s.leads.map((l) =>
                l.id === relatedId
                  ? {
                      ...l,
                      ...base,
                      humanCallAttempts:
                        type === "call"
                          ? (l.humanCallAttempts ?? 0) + 1
                          : l.humanCallAttempts,
                      lastHumanCallAt:
                        type === "call" ? now : l.lastHumanCallAt,
                    }
                  : l,
              )
            : s.leads,
        accounts:
          relatedType === "account"
            ? s.accounts.map((a) =>
                a.id === relatedId ? { ...a, ...base } : a,
              )
            : s.accounts,
        opportunities:
          relatedType === "opportunity"
            ? s.opportunities.map((o) => {
                if (o.id !== relatedId) return o;
                const eng = { ...o.engagement };
                if (type === "call") eng.calls = (eng.calls ?? 0) + 1;
                return { ...o, ...base, engagement: eng };
              })
            : s.opportunities,
      };
    });
  },

  simulateLoadGo: (vertical, max = DEFAULT_GO_BATCH_SIZE) => {
    if (!isSequenceVertical(vertical)) {
      return { ok: false, message: "Not a sequence vertical", count: 0 };
    }
    if (vertical === "hvac") {
      return {
        ok: false,
        message:
          "HVAC Nat'l is kill_candidate until RCA — pilot a non-HVAC vertical first",
        count: 0,
      };
    }
    const camp = INSTANTLY_CAMPAIGNS[vertical];
    const s = get();
    const eligible = s.leads
      .filter((l) => l.vertical === vertical && isLoadEligible(l))
      .slice(0, Math.min(max, DEFAULT_GO_BATCH_SIZE));
    if (eligible.length === 0) {
      return {
        ok: false,
        message: `No load-eligible ${vertical} leads in sample`,
        count: 0,
      };
    }
    const ids = new Set(eligible.map((l) => l.id));
    const now = touchNow();
    set((state) => ({
      leads: state.leads.map((l) =>
        ids.has(l.id)
          ? {
              ...l,
              lifecycle: "loaded_to_instantly" as const,
              status: "loaded_to_instantly" as const,
              instantlyCampaignId: camp.id,
              instantlyCampaignName: camp.name,
              nextAction: `In ${camp.name} sequence`,
              lastTouch: now,
              updatedAt: now,
            }
          : l,
      ),
      lastLoadGo: {
        vertical,
        count: eligible.length,
        at: now,
        leadIds: eligible.map((l) => l.id),
      },
      activities: [
        {
          id: `T-${++seq}`,
          type: "system" as const,
          subject: `Load GO (sandbox): ${eligible.length} → ${camp.name}`,
          body: `Simulated Instantly load for ${vertical}. Loader would deactivate after run. Not connected to n8n/Instantly.`,
          relatedType: "lead" as const,
          relatedId: eligible[0].id,
          relatedName: camp.name,
          ownerId: state.currentUserId,
          dueAt: null,
          completedAt: now,
          createdAt: now,
        },
        ...state.activities,
      ],
    }));
    return {
      ok: true,
      message: `Loaded ${eligible.length} → ${camp.name} (local only)`,
      count: eligible.length,
    };
  },
}));

export function getUserLabel(id: OwnerId | string): string {
  return users.find((u) => u.id === id)?.displayName ?? id;
}

export { users, DEMO_NOW };
