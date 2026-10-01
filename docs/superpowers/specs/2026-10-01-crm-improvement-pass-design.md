# CRM improvement pass (2026-10-01)

Founder ask: make the CRM functional and well designed, without touching the
opportunity, contract, send, PandaDoc or Stripe flow. Parent ticket RIV-1534
(auth lock, shipped b5053c7); follow-ups ticketed per slice.

## Who uses it and for what

- **Will (sales):** who do I call next, what happened last time, log the call.
- **Brayden:** plain totals (sent, opened, real replies, meetings) and anything
  that needs him. Not loader internals.

Success: every number on screen is live and matches across pages; every
button that looks like it saves, saves; a rep can work a call queue end to end.

## Out of scope (do not edit)

`routes/_app/opportunities/*`, `opp-workspace`, `opp-kanban`,
`patchOpportunityStage`, deal builder, send, PandaDoc, Stripe, contracts.
Opportunity server functions only gained the session check (RIV-1534).

## Slices, in order

1. **Truth.** No demo data on a live deploy.
   - Store starts empty and replaces slices from live; a failed or empty live
     read shows an error or empty state, never seed rows.
   - "Now" is the real clock on live (no fixed demo date, no "Future").
   - Home, Leads and Analytics read the same live book numbers.
   - Remove the hardcoded velocity chart, the 100% win rate with no closes,
     and the fake lifecycle funnel.
   - Activities: past touches are history, not overdue tasks; show real names,
     not IDs.
   - Remove the "paste the service role key in chat" setup text and the
     duplicate LIVE banners.
   - Load-eligible excludes DNC and paused leads, like the sequence query.
2. **Call queue.** The rep's main screen.
   - Platform migration: opens recorded on `gtm_touches` also mark
     `gtm_leads.email_opened` (trigger plus one-time backfill). Founder GO.
   - Leads gains a "Call queue" view: opened, has phone, not called, not DNC,
     not paused; most opens first; shows phone (tap to call) and line type.
   - Logging a call writes `call_attempts`, `call_outcome`, `last_call_date`
     on the lead and one `activities` row.
3. **Real identity.** Owner is the signed-in email; "My queue" works; next
   action and notes persist through the existing patch hooks; lead detail
   loads by id from the server.
4. **Design.** Fewer, plainer screens.
   - Home: one totals strip plus the call queue and website leads.
   - Retire the Sequences "Load GO" page (the loader runs itself); keep a
     read-only campaign list if it earns its place.
   - Plain-English copy, consistent states (loading, empty, error), one
     accent, tabular numbers.

## Verification per slice

`tsc --noEmit`, `npm test` (new tests for mappers and filters), `vite build`,
then an evaluator pass on the preview against the criteria above. Each slice
is its own PR; merge to main deploys production and needs the founder's GO.
