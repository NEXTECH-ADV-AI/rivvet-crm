import { Socket } from "node:net";
import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { emptyDealDraft, priceDeal, type DealDraft } from "./deal-catalog";
import { mapOpportunityRow } from "./wire/opportunity-map";
import { useCrmStore } from "./store";

beforeEach(() => {
  mock.method(Socket.prototype, "connect", () => {
    throw new Error("Real socket connections are denied in draft fixtures");
  });
});
afterEach(() => mock.restoreAll());

test("deal editor inputs retain discounts, free months and commerce performance terms", () => {
  const base = emptyDealDraft("2026-12-01");
  const service: DealDraft = {
    ...base,
    productId: "value_based",
    termMonths: 12,
    freeMonths: 2,
    monthlyDiscount: 50,
    setupFee: 500,
    payment: "Annual · Prepay",
  };
  const before = structuredClone(service);
  const priced = priceDeal(service);
  assert.equal(priced.monthly, 450);
  assert.equal(priced.billableMonths, 10);
  assert.equal(priced.tcv, 5000);
  assert.deepEqual(service, before, "pricing must not rewrite the editor's input");
  const commerce = priceDeal({
    ...base,
    tab: "commerce",
    performanceOption: "custom",
    customPerfRate: 8,
    customPerfTermMonths: 6,
    commerceSetupFee: 1000,
    commerceMonthlyRetainer: 250,
  });
  assert.deepEqual(commerce.perf, { rate: 8, termMonths: 6 });
  assert.equal(commerce.tcv, 2500);
  assert.equal(
    priceDeal({ ...service, monthlyDiscount: 900 }).monthly,
    0,
    "discounts cannot create negative recurring amounts",
  );
});

test("editing a local order draft changes only that draft and cannot send, charge or mutate provider mirrors", () => {
  const initial = useCrmStore.getState();
  const originalFetch = globalThis.fetch;
  let networkAttempts = 0;
  globalThis.fetch = (async () => {
    networkAttempts += 1;
    throw new Error("Networking is denied in the draft fixture");
  }) as typeof fetch;
  const opportunity = {
    ...mapOpportunityRow({
      opportunity_id: "11111111-1111-4111-8111-111111111111",
      opportunity_name: "Isolated draft fixture",
      stage: "proposal_contract",
      amount: 6000,
    }),
    lockedSendState: "sent" as const,
    lockedPaymentState: "paid" as const,
    pandadocDocumentId: "fixture-document",
    stripeCheckoutId: "fixture-checkout",
  };
  const sibling = { ...opportunity, id: "22222222-2222-4222-8222-222222222222" };
  const docs = [
    {
      id: "fixture-doc",
      opportunityId: opportunity.id,
      provider: "pandadoc" as const,
      status: "sent" as const,
      templateKey: "fixture",
      recipientEmail: "fixture@example.invalid",
      amount: 6000,
      createdAt: "2026-11-01",
      sentAt: "2026-11-01",
      signedAt: null,
      externalId: "fixture-document",
    },
  ];
  const payments = [
    {
      id: "fixture-pay",
      opportunityId: opportunity.id,
      provider: "stripe" as const,
      status: "paid" as const,
      amount: 6000,
      externalId: "fixture-checkout",
      createdAt: "2026-11-01",
      paidAt: "2026-11-01",
    },
  ];
  try {
    useCrmStore.setState({
      opportunities: [opportunity, sibling],
      sendDocuments: docs,
      payments,
      activities: [],
      stageEvents: [],
    });
    useCrmStore.getState().setDealConfig(opportunity.id, {
      productId: "value_based",
      freeMonths: 2,
      termMonths: 12,
      monthlyDiscount: 50,
      setupFee: 500,
    });
    const state = useCrmStore.getState();
    const changed = state.opportunities[0];
    assert.equal(changed.amount, 5000);
    assert.equal(changed.monthlyAmount, 450);
    assert.equal(changed.stage, opportunity.stage);
    assert.equal(changed.lockedSendState, "sent");
    assert.equal(changed.lockedPaymentState, "paid");
    assert.equal(changed.pandadocDocumentId, "fixture-document");
    assert.equal(changed.stripeCheckoutId, "fixture-checkout");
    assert.deepEqual(state.opportunities[1], sibling);
    assert.deepEqual(state.sendDocuments, docs);
    assert.deepEqual(state.payments, payments);
    assert.deepEqual(state.activities, []);
    assert.deepEqual(state.stageEvents, []);
    assert.equal(networkAttempts, 0);
  } finally {
    globalThis.fetch = originalFetch;
    useCrmStore.setState(initial, true);
  }
});
