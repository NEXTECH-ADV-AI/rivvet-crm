import { Socket } from "node:net";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import {
  getOpportunityRecordService,
  logTouchService,
  saveOpportunityService,
  setNextActionService,
} from "./record-service.server";
import { patchOpportunityStageService } from "./opportunity-service.server";
import { parseOpportunitySave } from "../opportunity-form";

const origin = "https://crm-fixture.invalid";
const oppId = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const contactId = "33333333-3333-4333-8333-333333333333";
const leadId = "44444444-4444-4444-8444-444444444444";
const taskId = "55555555-5555-4555-8555-555555555555";
const envKeys = ["CRM_DATA_SOURCE", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const originalFetch = globalThis.fetch;
const saved = new Map<string, string | undefined>();
type Call = { method: string; url: URL; body: Record<string, unknown> };
let calls: Call[];
let respond: (call: Call) => Response;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const noContent = () => new Response(null, { status: 204 });
const oppRef = {
  opportunity_id: oppId,
  account_id: accountId,
  source_gtm_lead_id: leadId,
  primary_contact_id: contactId,
  is_test: true,
  test_reason: "isolated fixture only",
};

// These services already use fetch as their transport. Replace it completely:
// no fallback, no real host, and no provider calls can escape the fixture.
describe("CRM mutation contracts with all networking intercepted", () => {
  beforeEach(() => {
    mock.method(Socket.prototype, "connect", () => {
      throw new Error("Real socket connections are denied in CRM fixtures");
    });
    envKeys.forEach((key) => saved.set(key, process.env[key]));
    process.env.CRM_DATA_SOURCE = "live";
    process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated-fixture-key";
    calls = [];
    respond = () => {
      throw new Error("Unexpected fixture request");
    };
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(url.origin, origin, "all non-fixture destinations are denied");
      const method = init?.method ?? "GET";
      const call = { method, url, body: init?.body ? JSON.parse(String(init.body)) : {} };
      calls.push(call);
      return respond(call);
    }) as typeof fetch;
  });
  afterEach(() => {
    mock.restoreAll();
    globalThis.fetch = originalFetch;
    envKeys.forEach((key) => {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });

  test("next step creates once, edits the same task, and clears by cancellation without crossing record scopes", async () => {
    assert.throws(
      () => new Socket().connect({ host: "network-probe.invalid", port: 443 }),
      /Real socket connections are denied/,
    );
    let task: Record<string, unknown> | null = null;
    respond = ({ method, url, body }) => {
      if (method === "GET" && url.pathname === "/rest/v1/crm_opportunities") return json([oppRef]);
      assert.equal(url.pathname, "/rest/v1/crm_tasks");
      if (method === "GET") {
        assert.equal(url.searchParams.get("opportunity_id"), `eq.${oppId}`);
        assert.equal(url.searchParams.get("source"), "eq.crm_next_action");
        return json(task && task.status !== "cancelled" ? [task] : []);
      }
      if (method === "POST") {
        assert.equal(task, null, "repeat saves must not create another next step");
        assert.equal(body.opportunity_id, oppId);
        assert.equal(body.account_id, null);
        assert.equal(body.gtm_lead_id, null);
        assert.equal(body.is_test, true);
        task = { ...body, task_id: taskId, status: "open" };
      } else {
        assert.equal(method, "PATCH");
        assert.equal(url.searchParams.get("task_id"), `eq.${taskId}`);
        assert.equal(url.searchParams.get("status"), "eq.open");
        task = { ...task, ...body };
      }
      return noContent();
    };
    const target = { opportunityId: oppId };
    const input = { title: "Confirm fixture appointment", dueDate: "2026-11-20" };
    await setNextActionService(target, input);
    assert.equal(
      calls.find((call) => call.method === "POST")?.body.due_at,
      "2026-11-20T12:00:00.000Z",
    );
    await setNextActionService(target, input);
    assert.equal(calls.filter((call) => call.method === "POST").length, 1);
    assert.equal(calls.filter((call) => call.method === "PATCH").length, 0);
    await setNextActionService(target, { title: "Send fixture agenda", dueDate: null });
    assert.equal(calls.at(-1)?.body.title, "Send fixture agenda");
    assert.equal(calls.at(-1)?.body.due_at, null);
    await setNextActionService(target, { title: null, dueDate: null });
    assert.equal(calls.at(-1)?.body.status, "cancelled");
    assert.equal(
      calls.some((call) => call.method === "DELETE"),
      false,
    );
  });

  test("failed next-step writes reject instead of reporting a saved task", async () => {
    respond = ({ method, url }) => {
      assert.equal(url.pathname, "/rest/v1/crm_tasks");
      return method === "GET" ? json([]) : json({ error: "fixture failure" }, 503);
    };
    await assert.rejects(
      setNextActionService({ accountId }, { title: "Fixture callback", dueDate: null }),
      /POST \/crm_tasks 503/,
    );
  });

  test("stage changes preserve production stage vocabulary and lost reason, with explicit failure", async () => {
    respond = ({ method, url }) => {
      assert.equal(method, "PATCH");
      assert.equal(url.pathname, "/rest/v1/crm_opportunities");
      assert.equal(url.searchParams.get("opportunity_id"), `eq.${oppId}`);
      return noContent();
    };
    assert.equal(
      (await patchOpportunityStageService({ opportunityId: oppId, stage: "proposal_out" })).ok,
      true,
    );
    assert.equal(calls.at(-1)?.body.stage, "proposal_contract");
    await patchOpportunityStageService({
      opportunityId: oppId,
      stage: "closed_lost",
      lostReason: "timing",
    });
    assert.equal(calls.at(-1)?.body.lost_reason, "timing");
    respond = () => json({ error: "fixture conflict" }, 409);
    assert.equal(
      (await patchOpportunityStageService({ opportunityId: oppId, stage: "demo_held" })).ok,
      false,
    );
    assert.equal(
      calls.every((call) =>
        Object.keys(call.body).every((key) => ["stage", "updated_at", "lost_reason"].includes(key)),
      ),
      true,
    );
  });

  test("manual call, email and note actions create history only, with exact opportunity lineage and provided actor", async () => {
    respond = ({ method, url }) => {
      if (method === "GET" && url.pathname === "/rest/v1/crm_opportunities") return json([oppRef]);
      assert.equal(method, "POST");
      assert.equal(
        url.pathname,
        "/rest/v1/activities",
        "manual logging must not call an email or voice provider",
      );
      return noContent();
    };
    for (const type of ["call", "email", "note"] as const) {
      await logTouchService(
        { opportunityId: oppId },
        { type, note: "Isolated fixture history", repEmail: "fixture@example.invalid" },
      );
      const body = calls.at(-1)!.body;
      assert.equal(body.account_id, accountId);
      assert.equal(body.gtm_lead_id, leadId);
      assert.deepEqual(body.payload, { rep: "fixture@example.invalid", opportunity_id: oppId });
      assert.equal(body.source, "crm_manual_log");
      assert.equal(body.channel, type === "note" ? null : type);
      assert.equal(body.direction, type === "note" ? null : "outbound");
    }
    const writes = calls.filter((call) => call.method === "POST");
    assert.equal(new Set(writes.map((call) => call.body.source_ref)).size, 3);
    respond = () => json({ error: "fixture failure" }, 503);
    await assert.rejects(
      logTouchService(
        { accountId },
        { type: "note", note: "Fixture", repEmail: "fixture@example.invalid" },
      ),
      /503/,
    );
  });

  test("opportunity Save preserves editable fields and returns stored values without stage or provider effects", async () => {
    let row: Record<string, unknown> = {
      ...oppRef,
      opportunity_name: "Fixture original",
      stage: "qualified",
      amount: null,
      expected_close_date: null,
      accounts: { name: "Fixture company", vertical: "hvac", primary_contact_id: contactId },
    };
    let contact = {
      contact_id: contactId,
      name: "Fixture Person",
      email: "fixture@example.invalid",
      phone: "5550101000",
      is_primary: true,
    };
    respond = ({ method, url, body }) => {
      const table = url.pathname.replace("/rest/v1/", "");
      if (method === "GET") {
        if (table === "crm_opportunities") return json([row]);
        if (table === "contacts") return json([contact]);
        if (table === "crm_tasks") return json([]);
      }
      assert.equal(method, "PATCH");
      if (table === "accounts") {
        assert.equal(url.searchParams.get("account_id"), `eq.${accountId}`);
        row = {
          ...row,
          accounts: { ...(row.accounts as object), name: body.name, vertical: body.vertical },
        };
      } else if (table === "contacts") {
        assert.equal(url.searchParams.get("contact_id"), `eq.${contactId}`);
        contact = { ...contact, ...body };
      } else {
        assert.equal(table, "crm_opportunities");
        assert.equal(url.searchParams.get("opportunity_id"), `eq.${oppId}`);
        assert.equal("stage" in body, false);
        row = { ...row, ...body };
      }
      return noContent();
    };
    const initial = await getOpportunityRecordService(oppId);
    assert.equal(initial.record?.form.amount, null);
    assert.equal(initial.record?.opportunity.amountKnown, false);
    const { form } = parseOpportunitySave({
      opportunityId: oppId,
      form: {
        ...initial.record!.form,
        name: " Updated fixture ",
        amount: "0",
        company: "Updated company",
        vertical: "plumbing",
        contactName: "Updated person",
        contactEmail: "updated@example.invalid",
        contactPhone: "5550102000",
        closeDate: "2026-12-01",
        nextStep: "",
        nextStepDue: null,
      },
    });
    const result = await saveOpportunityService(oppId, form);
    assert.deepEqual(result.record.form, form);
    assert.equal(result.record.opportunity.amountKnown, true);
    assert.equal(result.record.opportunity.stage, "qualified");
    assert.deepEqual(
      calls.filter((call) => call.method === "PATCH").map((call) => call.url.pathname),
      ["/rest/v1/accounts", "/rest/v1/contacts", "/rest/v1/crm_opportunities"],
    );
    assert.equal(
      calls.some((call) => call.method === "POST"),
      false,
    );
  });
});
