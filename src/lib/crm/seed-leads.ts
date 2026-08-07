import type {
  EmailVerificationStatus,
  Lead,
  LeadBookSnapshot,
  LeadLifecycle,
  Vertical,
  OwnerId,
  IcpBreakdown,
} from "./types";
import {
  INSTANTLY_CAMPAIGNS,
  SEQUENCE_VERTICALS,
  TARGET_STATES,
  intentFromIcp,
  isSequenceVertical,
  sumIcp,
  tierFromScore,
} from "./lead-model";
import { ago, inDays } from "./seed-time";

const FIRST = [
  "Priya", "Marcus", "Elena", "Chris", "Sam", "Jules", "Riley", "Devon",
  "Ava", "Noah", "Mia", "Leo", "Grace", "Owen", "Zoe", "Kai", "Nina", "Theo", "Ivy", "Hugo",
];
const LAST = [
  "Nair", "Webb", "Vos", "Alvarez", "Okonkwo", "Park", "Chen", "Blake",
  "Singh", "Rossi", "Kim", "Diaz", "Patel", "Nguyen", "Brooks", "Reed", "Shaw", "Cole", "Hayes", "Ortiz",
];
const CO = [
  "Summit", "Northline", "Brightpath", "Atlas", "Redwood", "Harbor", "Peak",
  "Oak", "Ironclad", "Bluebird", "Copper", "Granite", "Vanguard", "Pioneer",
  "Evergreen", "Sunbelt", "Metro", "Prairie", "Cascade", "Frontier",
];
const SUF: Record<Vertical, string[]> = {
  hvac: ["HVAC", "Comfort", "Heating & Air"],
  plumbing: ["Plumbing", "Pipe Pros"],
  electrical: ["Electric", "Power"],
  roofing: ["Roofing", "Roof Co"],
  pool: ["Pools", "Aqua Care"],
  cleaning: ["Cleaning", "Sparkle"],
  landscaping: ["Landscaping", "Lawn"],
  pest: ["Pest", "Bug Guard"],
  dental: ["Dental"],
  fleet: ["Fleet"],
  logistics: ["Logistics"],
  field_service: ["Field Service"],
  commerce: ["Commerce"],
  other: ["Services"],
};

function hash(n: number) {
  return (n * 1103515245 + 12345) & 0x7fffffff;
}
function pick<T>(arr: readonly T[], n: number): T {
  return arr[hash(n) % arr.length];
}

function icpFor(vertical: Vertical, lifecycle: LeadLifecycle, n: number): IcpBreakdown {
  const base = isSequenceVertical(vertical) ? 13 : 9;
  const boost = [
    "qualified_discovery",
    "demo_booked",
    "loaded_to_instantly",
    "verified",
  ].includes(lifecycle)
    ? 3
    : 0;
  const jitter = (hash(n + 7) % 5) - 2;
  const clamp = (v: number) => Math.max(2, Math.min(20, v));
  return {
    industryFit: clamp(base + boost + jitter),
    sizeFit: clamp(base - 1 + (hash(n + 1) % 4)),
    geoFit: clamp(10 + (hash(n + 2) % 8)),
    techFit: clamp(8 + (hash(n + 3) % 7)),
    budgetSignal: clamp(6 + boost + (hash(n + 4) % 6)),
  };
}

function emailStatusFor(
  lifecycle: LeadLifecycle,
  n: number,
): EmailVerificationStatus {
  if (lifecycle === "scraped" || lifecycle === "enrich_failed") return "pending";
  if (lifecycle === "verification_failed") return "invalid";
  if (
    lifecycle === "verified" ||
    lifecycle === "loaded_to_instantly" ||
    lifecycle === "qualified_discovery" ||
    lifecycle === "demo_booked" ||
    lifecycle === "demo_held" ||
    lifecycle === "proposal_out"
  ) {
    return "valid";
  }
  if (lifecycle === "enriched") {
    return hash(n) % 3 === 0 ? "pending" : "valid";
  }
  return hash(n) % 5 === 0 ? "valid" : "pending";
}

function buildLead(
  i: number,
  overrides: Partial<Lead> & { lifecycle: LeadLifecycle; vertical: Vertical },
): Lead {
  const n = 1000 + i;
  const first = pick(FIRST, n);
  const last = pick(LAST, n + 3);
  const vertical = overrides.vertical;
  const lifecycle = overrides.lifecycle;
  const co = `${pick(CO, n + 5)} ${pick(SUF[vertical] ?? SUF.other, n + 9)}`;
  const icp = overrides.icp ?? icpFor(vertical, lifecycle, n);
  const icpScore = overrides.icpScore ?? sumIcp(icp);
  const enrichmentStatus =
    overrides.enrichmentStatus ??
    (lifecycle === "scraped"
      ? "none"
      : lifecycle === "enriched" || lifecycle === "enrich_failed"
        ? "partial"
        : "complete");
  const emailVerificationStatus =
    overrides.emailVerificationStatus ?? emailStatusFor(lifecycle, n);
  const ownerVerified =
    overrides.ownerVerified ??
    ![
      "scraped",
      "enriched",
      "enrich_failed",
      "verification_failed",
    ].includes(lifecycle);
  const ownerId: OwnerId =
    overrides.ownerId ??
    (lifecycle === "scraped" || lifecycle === "enriched"
      ? "unassigned"
      : pick(["usr_you", "usr_you", "usr_maya", "usr_jordan"] as OwnerId[], n));

  const state = overrides.state ?? pick(TARGET_STATES, n);
  const camp =
    isSequenceVertical(vertical) &&
    (lifecycle === "loaded_to_instantly" || overrides.instantlyCampaignId)
      ? INSTANTLY_CAMPAIGNS[vertical as (typeof SEQUENCE_VERTICALS)[number]]
      : null;

  const hasEmail =
    enrichmentStatus !== "none" || emailVerificationStatus === "valid";

  return {
    id: overrides.id ?? `L-${1000 + i}`,
    gtmLeadId: overrides.gtmLeadId,
    externalRef: overrides.externalRef,
    name: overrides.name ?? `${first} ${last}`,
    company: overrides.company ?? co,
    title: overrides.title ?? pick(["Owner", "GM", "Ops Mgr", "VP Ops", "CEO"], n),
    email:
      overrides.email ??
      (hasEmail
        ? `${first.toLowerCase()}.${last.toLowerCase()}@${co.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`
        : ""),
    phone:
      overrides.phone ??
      (enrichmentStatus === "none"
        ? null
        : `+1 30${n % 10}-555-${String(1000 + (n % 9000)).slice(0, 4)}`),
    websiteUrl:
      overrides.websiteUrl ??
      (lifecycle === "scraped" && hash(n) % 4 === 0
        ? null
        : `https://www.${co.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`),
    lifecycle,
    status: lifecycle,
    ownerId,
    source: overrides.source ?? (lifecycle === "scraped" ? "google_maps" : "enrichment_pipeline"),
    sourceDetail: overrides.sourceDetail ?? overrides.scrapeBatch ?? null,
    vertical,
    enrichmentStatus,
    emailVerificationStatus,
    ownerVerified,
    icpScore,
    icpTier: overrides.icpTier ?? tierFromScore(icpScore),
    icp,
    employeeBand: overrides.employeeBand ?? pick(["1-10", "11-50", "51-200"], n),
    region: overrides.region ?? state,
    state,
    city: overrides.city ?? null,
    scoreIntent: overrides.scoreIntent ?? intentFromIcp(icpScore),
    nextAction: overrides.nextAction ?? null,
    nextActionDue: overrides.nextActionDue ?? null,
    nextCallbackAt: overrides.nextCallbackAt ?? null,
    humanCallAttempts: overrides.humanCallAttempts ?? 0,
    emailOpened: overrides.emailOpened ?? false,
    emailReplied: overrides.emailReplied ?? false,
    dncFlag: overrides.dncFlag ?? false,
    marketingPaused: overrides.marketingPaused ?? false,
    instantlyCampaignId:
      overrides.instantlyCampaignId ?? camp?.id ?? null,
    instantlyCampaignName:
      overrides.instantlyCampaignName ?? camp?.name ?? null,
    opportunityCreated: overrides.opportunityCreated,
    demoBookedAt: overrides.demoBookedAt,
    lastTouch: overrides.lastTouch ?? ago(hash(n) % 40),
    createdAt: overrides.createdAt ?? ago(30 + (hash(n) % 200)),
    updatedAt: overrides.updatedAt ?? ago(hash(n) % 20),
    amountHint:
      overrides.amountHint ??
      (icpScore >= 60 ? 15000 + (hash(n) % 80) * 1000 : null),
    accountId: overrides.accountId ?? null,
    convertedOppId: overrides.convertedOppId ?? null,
    tags: overrides.tags ?? [vertical, lifecycle, state],
    enrichedAt:
      overrides.enrichedAt ??
      (enrichmentStatus === "none" ? null : ago(hash(n + 11) % 60)),
    scrapeBatch: overrides.scrapeBatch ?? `batch_${state}_${vertical}_${(hash(n) % 6) + 1}`,
  };
}

export function buildSeedLeads(): Lead[] {
  const story: Lead[] = [
    buildLead(42, {
      id: "L-1042",
      name: "Priya Nair",
      company: "Summit Fleet",
      title: "VP Ops",
      email: "priya@summitfleet.com",
      phone: "+1 303-555-0142",
      lifecycle: "qualified_discovery",
      vertical: "fleet",
      source: "inbound_demo",
      ownerId: "usr_you",
      lastTouch: ago(2, 4),
      createdAt: ago(2),
      amountHint: 42000,
      accountId: "A-220",
      convertedOppId: "O-881",
      state: "CO",
      emailVerificationStatus: "valid",
      ownerVerified: true,
      enrichmentStatus: "complete",
      opportunityCreated: true,
      tags: ["inbound", "fleet"],
      icp: { industryFit: 16, sizeFit: 15, geoFit: 14, techFit: 17, budgetSignal: 16 },
    }),
    buildLead(38, {
      id: "L-1038",
      name: "Marcus Webb",
      company: "Northline HVAC",
      title: "Owner",
      email: "marcus@northlinehvac.com",
      lifecycle: "proposal_out",
      vertical: "hvac",
      source: "partner",
      ownerId: "usr_you",
      nextAction: "Send pilot scope",
      nextActionDue: inDays(-1),
      lastTouch: ago(4),
      createdAt: ago(12),
      amountHint: 28000,
      accountId: "A-214",
      convertedOppId: "O-874",
      state: "CO",
      emailVerificationStatus: "valid",
      ownerVerified: true,
      enrichmentStatus: "complete",
      opportunityCreated: true,
      tags: ["partner", "hvac"],
      icp: { industryFit: 19, sizeFit: 14, geoFit: 16, techFit: 12, budgetSignal: 15 },
    }),
    buildLead(31, {
      id: "L-1031",
      name: "Elena Vos",
      company: "Brightpath Dental",
      title: "COO",
      email: "elena@brightpath.dental",
      lifecycle: "demo_held",
      vertical: "dental",
      source: "outbound",
      ownerId: "usr_you",
      nextAction: "Book discovery call",
      nextActionDue: inDays(1),
      lastTouch: ago(8),
      createdAt: ago(18),
      amountHint: 18000,
      accountId: "A-208",
      convertedOppId: "O-865",
      state: "CA",
      emailVerificationStatus: "valid",
      opportunityCreated: true,
      ownerVerified: true,
      enrichmentStatus: "complete",
    }),
    buildLead(24, {
      id: "L-1024",
      name: "Chris Alvarez",
      company: "Redwood Logistics",
      title: "Dir. Revenue",
      email: "chris@redwoodlog.com",
      lifecycle: "nurture",
      vertical: "logistics",
      source: "event",
      ownerId: "usr_maya",
      nextAction: "Quarterly check-in",
      nextActionDue: inDays(20),
      lastTouch: ago(21),
      createdAt: ago(45),
      accountId: "A-198",
      state: "CA",
      emailVerificationStatus: "valid",
      tags: ["event"],
      ownerVerified: true,
      enrichmentStatus: "complete",
      icpScore: 48,
    }),
    buildLead(19, {
      id: "L-1019",
      name: "Sam Okonkwo",
      company: "Atlas Field Service",
      title: "CEO",
      email: "sam@atlasfs.com",
      lifecycle: "demo_booked",
      vertical: "field_service",
      source: "referral",
      ownerId: "usr_you",
      nextAction: "Confirm tech fit",
      nextActionDue: inDays(0),
      lastTouch: ago(1),
      createdAt: ago(6),
      amountHint: 65000,
      accountId: "A-201",
      convertedOppId: "O-852",
      state: "NY",
      emailVerificationStatus: "valid",
      opportunityCreated: true,
      demoBookedAt: ago(2),
      ownerVerified: true,
      enrichmentStatus: "complete",
    }),
    buildLead(12, {
      id: "L-1012",
      name: "Jules Park",
      company: "Harbor Clinics",
      title: "Procurement",
      email: "jules@harborclinics.org",
      lifecycle: "verified",
      vertical: "dental",
      source: "inbound",
      ownerId: "usr_jordan",
      lastTouch: ago(0, 6),
      createdAt: ago(0, 6),
      amountHint: 22000,
      accountId: "A-190",
      convertedOppId: "O-840",
      state: "WA",
      emailVerificationStatus: "valid",
      ownerVerified: true,
      enrichmentStatus: "complete",
    }),
    buildLead(7, {
      id: "L-1007",
      name: "Riley Chen",
      company: "Oak Street Auto",
      title: "GM",
      email: "riley@oakstreetauto.com",
      lifecycle: "disqualified",
      vertical: "other",
      source: "outbound",
      sourceDetail: "No budget FY26",
      ownerId: "usr_you",
      lastTouch: ago(30),
      createdAt: ago(40),
      state: "TX",
      emailVerificationStatus: "valid",
      tags: ["dq"],
      ownerVerified: true,
      enrichmentStatus: "partial",
      icpScore: 28,
    }),
    buildLead(48, {
      id: "L-1048",
      name: "Devon Blake",
      company: "Peak Roofing Co",
      title: "Ops Manager",
      email: "devon@peakroofing.co",
      lifecycle: "enriched",
      vertical: "roofing",
      source: "inbound_demo",
      ownerId: "usr_you",
      nextAction: "Verify owner title",
      nextActionDue: inDays(0),
      lastTouch: ago(0, 2),
      createdAt: ago(0, 2),
      amountHint: 31000,
      state: "AZ",
      emailVerificationStatus: "pending",
      tags: ["inbound", "needs-verify"],
      ownerVerified: false,
      enrichmentStatus: "partial",
    }),
    // Sequence-ready multi-vertical examples (not loaded yet)
    buildLead(50, {
      id: "L-1050",
      name: "Ava Brooks",
      company: "Sunbelt Pools",
      lifecycle: "verified",
      vertical: "pool",
      state: "FL",
      email: "ava@sunbeltpools.com",
      emailVerificationStatus: "valid",
      enrichmentStatus: "complete",
      ownerVerified: true,
      nextAction: "Load to Pool Service campaign",
      nextActionDue: inDays(0),
      tags: ["sequence-ready", "pool"],
    }),
    buildLead(51, {
      id: "L-1051",
      name: "Noah Reed",
      company: "Metro Sparkle Cleaning",
      lifecycle: "verified",
      vertical: "cleaning",
      state: "TX",
      email: "noah@metrosparkle.com",
      emailVerificationStatus: "valid",
      enrichmentStatus: "complete",
      ownerVerified: true,
      nextAction: "Load to Cleaning campaign",
      nextActionDue: inDays(1),
      tags: ["sequence-ready", "cleaning"],
    }),
    buildLead(52, {
      id: "L-1052",
      name: "Mia Shaw",
      company: "Cascade Landscaping",
      lifecycle: "loaded_to_instantly",
      vertical: "landscaping",
      state: "OR",
      email: "mia@cascadeland.com",
      emailVerificationStatus: "valid",
      enrichmentStatus: "complete",
      ownerVerified: true,
      instantlyCampaignId: INSTANTLY_CAMPAIGNS.landscaping.id,
      instantlyCampaignName: INSTANTLY_CAMPAIGNS.landscaping.name,
      tags: ["in-instantly", "landscaping"],
    }),
    buildLead(53, {
      id: "L-1053",
      name: "Leo Cole",
      company: "Prairie Pest Pros",
      lifecycle: "verified",
      vertical: "pest",
      state: "IL",
      email: "leo@prairiepest.com",
      emailVerificationStatus: "valid",
      enrichmentStatus: "complete",
      ownerVerified: true,
      nextAction: "Load to Pest Control campaign",
      tags: ["sequence-ready", "pest"],
    }),
    buildLead(54, {
      id: "L-1054",
      name: "Grace Hayes",
      company: "Frontier Plumbing TX",
      lifecycle: "loaded_to_instantly",
      vertical: "plumbing",
      state: "TX",
      email: "grace@frontierplumb.com",
      emailVerificationStatus: "valid",
      enrichmentStatus: "complete",
      ownerVerified: true,
      instantlyCampaignId: INSTANTLY_CAMPAIGNS.plumbing.id,
      instantlyCampaignName: INSTANTLY_CAMPAIGNS.plumbing.name,
      emailOpened: true,
      tags: ["in-instantly", "plumbing"],
    }),
  ];

  const synth: Lead[] = [];
  const plan: {
    lifecycle: LeadLifecycle;
    vertical: Vertical;
    count: number;
    load?: boolean;
  }[] = [
    // Scrapes: multi-vertical multi-geo (not HVAC-only)
    { lifecycle: "scraped", vertical: "hvac", count: 8 },
    { lifecycle: "scraped", vertical: "plumbing", count: 4 },
    { lifecycle: "scraped", vertical: "pool", count: 3 },
    { lifecycle: "scraped", vertical: "cleaning", count: 3 },
    { lifecycle: "scraped", vertical: "pest", count: 3 },
    { lifecycle: "scraped", vertical: "landscaping", count: 3 },
    { lifecycle: "scraped", vertical: "electrical", count: 2 },
    // Enrich backlog
    { lifecycle: "enriched", vertical: "hvac", count: 3 },
    { lifecycle: "enriched", vertical: "pool", count: 2 },
    { lifecycle: "enriched", vertical: "plumbing", count: 2 },
    // Sequence-ready not loaded
    { lifecycle: "verified", vertical: "hvac", count: 2 },
    { lifecycle: "verified", vertical: "pool", count: 2 },
    { lifecycle: "verified", vertical: "cleaning", count: 1 },
    { lifecycle: "verified", vertical: "pest", count: 1 },
    // In Instantly (sparse non-HVAC)
    { lifecycle: "loaded_to_instantly", vertical: "hvac", count: 3, load: true },
    { lifecycle: "loaded_to_instantly", vertical: "plumbing", count: 1, load: true },
    { lifecycle: "loaded_to_instantly", vertical: "landscaping", count: 1, load: true },
  ];

  let i = 200;
  for (const p of plan) {
    for (let k = 0; k < p.count; k++) {
      i += 1;
      const st = pick(TARGET_STATES, i + k * 17);
      const load = p.load || p.lifecycle === "loaded_to_instantly";
      const camp =
        load && isSequenceVertical(p.vertical)
          ? INSTANTLY_CAMPAIGNS[
              p.vertical as (typeof SEQUENCE_VERTICALS)[number]
            ]
          : null;
      synth.push(
        buildLead(i, {
          lifecycle: p.lifecycle,
          vertical: p.vertical,
          state: st,
          source: p.lifecycle === "scraped" ? "google_maps" : "enrichment_pipeline",
          scrapeBatch: `natl_${p.vertical}_${st}_${(k % 4) + 1}`,
          emailVerificationStatus:
            p.lifecycle === "verified" || p.lifecycle === "loaded_to_instantly"
              ? "valid"
              : p.lifecycle === "enriched"
                ? "pending"
                : "pending",
          instantlyCampaignId: camp?.id ?? null,
          instantlyCampaignName: camp?.name ?? null,
          nextAction:
            p.lifecycle === "enriched"
              ? "Run email verify"
              : p.lifecycle === "verified"
                ? `Load to ${camp?.name ?? p.vertical} campaign`
                : null,
          nextActionDue:
            p.lifecycle === "enriched" || p.lifecycle === "verified"
              ? inDays(hash(i) % 4)
              : null,
        }),
      );
    }
  }

  return [...story, ...synth].map((l) => ({
    ...l,
    icpScore: sumIcp(l.icp),
    icpTier: tierFromScore(sumIcp(l.icp)),
    scoreIntent: intentFromIcp(sumIcp(l.icp)),
    status: l.lifecycle,
  }));
}

/** Full-book snapshot — mirrors prod order-of-magnitude, multi-vertical truth */
export const leadBookSnapshot: LeadBookSnapshot = {
  total: 53531,
  asOf: "2026-08-06",
  byLifecycle: {
    scraped: 48210,
    enriched: 2840,
    verified: 920,
    loaded_to_instantly: 410,
    qualified_discovery: 286,
    demo_booked: 48,
    demo_held: 32,
    proposal_out: 28,
    nurture: 312,
    disqualified: 66,
  },
  byVertical: {
    hvac: 36840,
    plumbing: 4120,
    pool: 2100,
    cleaning: 1800,
    pest: 1600,
    landscaping: 1400,
    electrical: 1800,
    roofing: 1200,
    other: 671,
  },
  validEmail: 1093,
  sequenceReady: 890,
  inInstantly: 169,
  enriched: 4866,
  ownerVerified: 2026,
  icpA: 380,
  icpB: 1120,
  workable: 1488,
  byCampaignLoads: {
    "HVAC Nat'l": 169,
    Plumbing: 0,
    "Pool Service": 0,
    Cleaning: 0,
    "Pest Control": 0,
    Landscaping: 0,
  },
  statesInLoads: 8,
  hvacSharePct: 69,
  notes:
    "Prod-shaped: ~53k scrapes · ~1.1k valid email · ~890 sequence-ready · HVAC Nat'l only campaign with sends (0 replies). Multi-vertical Instantly campaigns exist but idle.",
};
