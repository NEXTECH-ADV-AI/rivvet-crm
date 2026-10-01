import { test } from "node:test";
import assert from "node:assert/strict";
import { accountOpportunityPlan, parseCreateOpportunity } from "./opportunity-create";

const LEAD = "2f1dfb20-1111-4222-8333-444455556666";
const LEAD2 = "2f1dfb20-1111-4222-8333-444455557777";

test("the form is trimmed, the email lowercased, and an unknown stage falls back to Qualified", () => {
  assert.deepEqual(
    parseCreateOpportunity({
      from: "new",
      company: "  Hillside HVAC ",
      email: " Joe@Hillside.COM ",
      stage: "closed_won",
    }),
    {
      from: "new",
      company: "Hillside HVAC",
      contact: null,
      email: "joe@hillside.com",
      phone: null,
      stage: "qualified",
    },
  );
  assert.equal(
    parseCreateOpportunity({ from: "new", company: "A", stage: "demo_held" }).from,
    "new",
  );
});

test("a missing company, a bad email, or a non-uuid id is refused", () => {
  assert.throws(() => parseCreateOpportunity({ from: "new", company: "  " }), /Company name/);
  assert.throws(
    () => parseCreateOpportunity({ from: "new", company: "A", email: 'a@b.com",x' }),
    /email/,
  );
  assert.throws(
    () => parseCreateOpportunity({ from: "lead", gtmLeadId: "L-2F1DFB20" }),
    /Invalid record id/,
  );
  assert.throws(
    () => parseCreateOpportunity({ from: "account", accountId: "1;drop" }),
    /Invalid record id/,
  );
  assert.throws(() => parseCreateOpportunity({ from: "stripe" }), /Unknown/);
  assert.deepEqual(parseCreateOpportunity({ from: "account", accountId: LEAD, stage: "demo_booked" }), {
    from: "account",
    accountId: LEAD,
    stage: "demo_booked",
  });
  assert.deepEqual(parseCreateOpportunity({ from: "account", accountId: LEAD, stage: "closed_won" }), {
    from: "account",
    accountId: LEAD,
  });
  assert.deepEqual(parseCreateOpportunity({ from: "lead", gtmLeadId: LEAD }), {
    from: "lead",
    gtmLeadId: LEAD,
  });
});

test("an account with an open Opportunity opens it instead of making a second one", () => {
  const opps = [
    { opportunity_id: "o1", stage: "closed_lost", source_gtm_lead_id: LEAD },
    { opportunity_id: "o2", stage: "demo_booked", source_gtm_lead_id: LEAD2 },
  ];
  assert.deepEqual(accountOpportunityPlan([LEAD, LEAD2], opps), {
    kind: "existing",
    opportunityId: "o2",
  });
});

test("an account creates from a lead with no Opportunity yet, or reports there is none", () => {
  const lost = [{ opportunity_id: "o1", stage: "closed_lost", source_gtm_lead_id: LEAD }];
  assert.deepEqual(accountOpportunityPlan([LEAD, LEAD2], lost), {
    kind: "create",
    gtmLeadId: LEAD2,
  });
  assert.deepEqual(accountOpportunityPlan([LEAD], lost), { kind: "none" });
  assert.deepEqual(accountOpportunityPlan([], []), { kind: "none" });
});
