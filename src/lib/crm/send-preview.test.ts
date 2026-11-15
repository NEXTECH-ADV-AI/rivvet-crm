import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Render the actual route with every data/provider import replaced. Unknown imports
// fail closed, so the SSR regression cannot touch the real CRM or a provider.
const source = readFileSync(new URL("../../routes/_app/opportunities/$oppId.send.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const opportunity = { id: "fixture-opp", name: "Fixture opportunity", accountName: "Fixture account", amount: 100 };

test("send preview SSR handles cold reads, failures and missing records without enabling sending", () => {
  let reads = 0;
  let retries = 0;
  const render = (state: { isPending?: boolean; isError?: boolean; isFetching?: boolean; data?: unknown }, cached = false) => {
    const exports: Record<string, unknown> = {};
    const store = { opportunities: cached ? [opportunity] : [], sendDocuments: [], payments: [] };
    const stubs: Record<string, unknown> = {
      react: React,
      "react/jsx-runtime": jsx,
      "@tanstack/react-router": {
        createFileRoute: () => (options: object) => ({ ...options, useParams: () => ({ oppId: opportunity.id }) }),
        Link: ({ children }: { children: React.ReactNode }) => React.createElement("a", { href: "/opportunities" }, children),
      },
      "lucide-react": { ArrowLeft: () => null, Lock: () => null },
      "@/components/crm/locked-banner": { LockedBanner: () => React.createElement("p", null, "Provider path locked") },
      "@/components/crm/integration-mirror": { IntegrationMirror: () => null },
      "@/lib/crm/store": { useCrmStore: (select: (value: typeof store) => unknown) => select(store) },
      "@/lib/crm/wire": { useOpportunityRecord: (id: string) => {
        assert.equal(id, opportunity.id);
        reads++;
        return { ...state, refetch: () => { retries++; } };
      } },
      "@/lib/crm/priority": { formatMoney: (amount: number) => `$${amount}` },
    };
    runInNewContext(compiled, { exports, require: (id: string) => {
      assert.ok(Object.hasOwn(stubs, id), `Unmocked dependency denied: ${id}`);
      return stubs[id];
    } });
    const route = exports.Route as { component: React.ComponentType };
    return renderToStaticMarkup(React.createElement(route.component));
  };
  assert.match(render({ isPending: true }), /Loading the opportunity/);
  const failed = render({ isError: true });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Try again/);
  assert.match(failed, /Back to Opportunities/);
  assert.match(render({ isError: true, isFetching: true }), /disabled=""[^>]*>Retrying/);
  const missing = render({ data: { record: null } });
  assert.match(missing, /doesn&#x27;t exist or is no longer available/);
  assert.doesNotMatch(missing, /Loading the opportunity/);
  for (const html of [render({ data: { record: { opportunity } } }), render({ isPending: true }, true)]) {
    assert.match(html, /Send proposal/);
    assert.match(html, /Provider path locked/);
    assert.match(html, /disabled=""[^>]*>SEND DISABLED IN SANDBOX/);
  }
  assert.equal(reads, 6);
  assert.equal(retries, 0, "rendering must never initiate retry or business actions");
});
