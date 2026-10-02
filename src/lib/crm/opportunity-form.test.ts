import { test } from "node:test";
import assert from "node:assert/strict";
import { formChanged, parseOpportunitySave, pickContactId } from "./opportunity-form";

const id = "564e2e9f-9907-4c1c-a69a-9d7b69b164c4";
const base = {
  name: " Test Shop ",
  amount: "$12,500",
  closeDate: "2026-11-30",
  company: "Test Shop",
  vertical: "hvac",
  contactName: "Pat Doe",
  contactEmail: " Pat@Example.com ",
  contactPhone: "(555) 010-2000",
  nextStep: "Send the quote",
  nextStepDue: "2026-10-06",
};

test("a full form parses trimmed, with the amount as a number", () => {
  const { opportunityId, form } = parseOpportunitySave({ opportunityId: id, form: base });
  assert.equal(opportunityId, id);
  assert.equal(form.name, "Test Shop");
  assert.equal(form.amount, 12500);
  assert.equal(form.contactEmail, "pat@example.com");
  assert.equal(form.closeDate, "2026-11-30");
});

test("blank amount and dates save as empty, not zero", () => {
  const { form } = parseOpportunitySave({ opportunityId: id, form: { ...base, amount: "", closeDate: "", nextStepDue: null } });
  assert.equal(form.amount, null);
  assert.equal(form.closeDate, null);
  assert.equal(form.nextStepDue, null);
});

test("bad input is refused before it reaches the database", () => {
  const bad = (form: object, msg: RegExp, oid = id) =>
    assert.throws(() => parseOpportunitySave({ opportunityId: oid, form: { ...base, ...form } }), msg);
  bad({}, /Invalid opportunity id/, "not-a-uuid");
  bad({}, /Invalid opportunity id/, `${id}&stage=eq.closed_won`);
  bad({ name: "  " }, /needs a name/);
  bad({ amount: "-5" }, /dollar figure/);
  bad({ amount: "ten" }, /dollar figure/);
  bad({ closeDate: "2026-13-45" }, /real date/);
  bad({ contactEmail: "pat@" }, /email/);
  bad({ contactPhone: "call me" }, /phone/);
});

test("the contact edited is the opportunity's, then the account's primary, then its first", () => {
  const contacts = [
    { contact_id: "c1", is_primary: false },
    { contact_id: "c2", is_primary: true },
  ];
  assert.equal(pickContactId("own", "acct", contacts), "own");
  assert.equal(pickContactId(null, "acct", contacts), "acct");
  assert.equal(pickContactId(null, null, contacts), "c2");
  assert.equal(pickContactId(null, null, [{ contact_id: "c1", is_primary: false }]), "c1");
  assert.equal(pickContactId(null, null, []), null);
});

test("Save lights up only for a real change", () => {
  const { form } = parseOpportunitySave({ opportunityId: id, form: base });
  assert.equal(formChanged(form, { ...form }), false);
  assert.equal(formChanged(form, { ...form, amount: 1 }), true);
});
