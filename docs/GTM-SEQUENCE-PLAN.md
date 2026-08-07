# GTM Sequence Plan — FINAL

**Status:** FINAL (adversarially reviewed 2026-08-07)  
**Scope:** Right leads → multi-vertical Instantly sequences → CRM control surface  
**Out of scope:** Cold call / dial agents · deal-builder/PandaDoc/Stripe rewrites · dual backends  

---

## 0. Adversarial review — what was wrong in v1

| v1 claim | Failure mode | Fix in FINAL |
|----------|--------------|--------------|
| “Equal volume across 6 verticals” | Ignores market size; forces pest = HVAC scrapes | **Capacity + supply quotas**, not equal scrapes |
| HVAC ≤35% of loads as hard rule | Stalls all loads if non-HVAC ready pool is empty | Cap **only when non-HVAC ready ≥ threshold** |
| Sequence-ready / book ≥ 3% | Book is 48k scrapes; ratio is a vanity trap | Track **absolute ready**, **enrich→valid rate**, **load fill** |
| Activate all 5 idle campaigns (B2) next to HVAC RCA | Spreads domain burn before knowing why HVAC got 0 replies | **Pilot 1 non-HVAC (≤50)** → RCA HVAC → then expand |
| Sequence-ready ≈ Instantly-loadable | Missing unload + campaign match + domain health | Split **ready** vs **load-eligible** vs **loaded** |
| 90d “≥15 states” alone | Scrapes states with no sales coverage | Geo = **metros we can close**, not map coloring |
| FE wire Supabase as “next” without query contract | Wrong indexes, full-book pulls | Ship **predicate + index contract** first |
| Metrics list without kill criteria | Zombie campaigns forever | **Kill / pause rules** per campaign |
| No reply SLA | Sequences without human response waste spend | **Reply → human <2h** in success criteria |
| “This week: 5 parallel tracks” | Everything is P0 → nothing ships | **Single-threaded weekly order** |

---

## 1. Problem (facts, not narrative)

| Signal | Fact (prod brain ~Jul 2026) |
|--------|------------------------------|
| Book | ~53.5k `gtm_leads` |
| Valid email | ~1.1k |
| Launchable / sequence-ready | ~0.5–0.9k |
| Instantly | 6 campaigns named; **1 sent** (HVAC Nat’l: 169 leads, 819 sends, **0 replies**) |
| Other 5 | status 0 / idle |
| Loader | `[GTM] Lead Load - Instantly` **OFF** until explicit GO |
| Cold call | **Paused** — not this plan’s bottleneck |
| Domain risk | Scaling broken HVAC motion multiplies 0-reply cost |

**Wrong:** more HVAC scrapes, dial UI, FE vanity on 53k.  
**Right:** multi-vertical **load-eligible** supply → **small GO batches** → measure replies → only then scale.

---

## 2. Definitions (hard)

### 2.1 Sequence-ready (inventory truth)

All of:

1. `vertical` ∈ SEQUENCE_VERTICALS: hvac · pool · cleaning · plumbing · pest · landscaping  
2. `email_verification_status = valid` + non-empty email  
3. Not DNC / test / `marketing_paused`  
4. Enrichment past scrape (`enrichment_status` ∉ {none, failed})  
5. Status not DQ / closed_lost  

### 2.2 Load-eligible (can enter a GO batch)

Sequence-ready **plus**:

6. Not already loaded (`instantly_campaign_id` IS NULL and status ≠ `loaded_to_instantly`)  
7. Target campaign matches vertical (no cross-load)  
8. Vertical’s Instantly campaign exists and is not **killed**  
9. Batch passes NeverBounce **≤3% invalid** (batch-level)  
10. Domain/mailbox health for that campaign not in halt state  

### 2.3 Views (CRM)

| Operator mode | Default view |
|---------------|--------------|
| GTM ops | **Load-eligible** (ready − loaded) |
| Data ops | Needs enrich → Needs verify |
| Sales | Replied / demo / open opp — not scrapes |
| Never | Full 53k scrapes as home |

### 2.4 North-star metrics (ordered)

1. **Reply rate by campaign** (and by vertical)  
2. **Load-eligible not loaded** (backlog that can GO)  
3. **Valid-email rate among enriched**  
4. **Non-HVAC share of new loads** (when supply allows)  
5. Absolute sequence-ready count  

*Do not optimize total scrapes or sequence-ready/book %.*

---

## 3. Operating principles

1. **Email sequences first.** Cold call stays paused until multi-vertical email has measured replies.  
2. **Small batches.** Default GO = **≤50** leads, single vertical.  
3. **Non-HVAC pilot before HVAC scale.** One idle campaign first; HVAC RCA in parallel, not HVAC volume.  
4. **Cap HVAC when alternatives exist.** If load-eligible non-HVAC ≥ 30, HVAC share of a GO week ≤ 35%. If non-HVAC ready is thin, load what exists — don’t invent false diversity.  
5. **Scrape follows enrich capacity.** No S1 dump while enrich/verify queue exceeds weekly capacity.  
6. **Loader off by default.** Activate → load → **deactivate**.  
7. **Reply SLA.** Hot replies route to human within 2 hours (existing Instantly/Slack path).  
8. **Sacred money path untouched.** Deal builder / PandaDoc / Stripe unchanged.  
9. **Sandbox does not connect.** Mirror predicates only until explicit wire-up.  

---

## 4. Weekly single-thread (execution order)

Do **not** parallelize these as five P0s. Order:

| Week | Focus | Exit gate |
|------|--------|-----------|
| **W0 (now)** | Sandbox IA + query contracts + Load GO board (local) | Operators can only work sequence views |
| **W1** | Live SQL: ready / eligible by vertical×state; HVAC RCA start | Numbers trusted |
| **W2** | **One** non-HVAC Load GO ≤50 (Pool **or** Plumbing) | Sends > 0, bounce tracked |
| **W3** | HVAC RCA decision: fix copy/list/domains **or** pause HVAC Nat’l | Written decision |
| **W4** | Second non-HVAC GO if W2 reply/bounce healthy | 2 verticals live |
| **W5+** | Expand verticals only under kill/scale rules §7 | ≥3 verticals or documented block |

---

## 5. Workstreams (final)

### A. Data ops

| ID | Work | Acceptance |
|----|------|------------|
| A1 | SQL view/materialization: `v_sequence_ready`, `v_load_eligible` | Matches §2 |
| A2 | Indexes: `(status)`, `(vertical, state)`, `(email_verification_status)`, `(instantly_campaign_id)`, partial eligible | p95 list < 500ms @ 53k |
| A3 | S1 matrix = vertical × **approved metros** (sales-covered), not “15 random states” | Matrix doc in repo |
| A4 | Scrape throttle when enrich/verify backlog > weekly capacity | n8n gate or manual stop |
| A5 | Enrich priority: website + non-HVAC first | Batch logs |
| A6 | NeverBounce 3% halt visible in CRM strip | Halt flag |
| A7 | Quarantine unknown/contaminated verticals | Loader refuses |

### B. Instantly

| ID | Work | Acceptance |
|----|------|------------|
| B1 | Load GO checklist enforced (sandbox UI + ops runbook) | Checklist used every GO |
| B2 | **Pilot** one non-HVAC campaign ≤50 | status active, sends > 0 |
| B3 | HVAC Nat’l RCA (domains, bounce, copy, list quality, offer) | Decision: fix / pause / kill |
| B4 | Engagement sync Instantly → `gtm_leads` | Open/reply within ~2h of Instantly |
| B5 | Scale other verticals only per §7 | No mass load |
| B6 | Reply handler SLA monitored | <2h human on positive intent |

### C. CRM FE (sandbox → later wire)

| ID | Work | Status |
|----|------|--------|
| C1 | Sequence-ready / load-eligible defaults | Done |
| C2 | Multi-vertical · multi-state filters · book strip | Done |
| C3 | Instantly load mix widget | Done |
| C4 | Dial-first UX removed from defaults | Done |
| C5 | **Load GO board** + checklist + local simulate load | **This pass** |
| C6 | Query/predicate contract for wire-up | **This pass** |
| C7 | Agent strip: load-eligible before vanity | **This pass** |
| C8 | Wire Supabase read (pagination) | Blocked on A1–A2 + founder GO |
| C9 | Deal builder locked send | Done — never rewrite |

### D. Deferred

Cold call · dial tiers productization · AI priority on scrapes · forecast gold-plating · PandaDoc/Stripe rebuild.

---

## 6. Load GO checklist (mandatory)

Before loader ON:

1. Single vertical for this batch  
2. All rows load-eligible (§2.2)  
3. Campaign ID matches vertical  
4. Batch size ≤ 50 (or written exception)  
5. HVAC share rule (§3.4) applied  
6. State concentration: flag if ≥80% one state (not hard block if market is regional)  
7. NeverBounce invalid ≤ 3%  
8. Domains not in spam/bounce halt  
9. Loader OFF after run  
10. Log batch id + vertical + counts to ops channel  

---

## 7. Kill / scale rules

| Condition | Action |
|-----------|--------|
| Bounce > 2% on a campaign | Auto-pause campaign; RCA before reload |
| ≥200 sends, 0 replies | Pause; RCA (do not “just add more leads”) |
| Reply rate healthy, invalid < 1% | May scale batch size (still prefer ≤100 until 3 verticals proven) |
| Vertical has 0 load-eligible for 14d | Fix enrich/verify/scrape for that vertical — don’t reassign HVAC leftovers |
| Domain reputation event | Halt **all** GTM loads for that domain |

---

## 8. Scrape matrix (corrected)

```
S1 = { vertical ∈ SEQUENCE_VERTICALS } × { metro ∈ APPROVED_SALES_METROS }
Quota per week: proportional to (close capacity × current load-eligible deficit)
Not: equal scrapes · not: 5-state HVAC default · not: national vanity states
```

Prefer metros with website density (enrich yield). Dedup unchanged.

---

## 9. Query contract (wire-up)

See `src/lib/crm/sequence-queries.ts` (sandbox source of truth for predicates).

Required filters for list API:

- `view`: load_eligible | needs_enrich | needs_verify | in_instantly | high_icp  
- `vertical`, `state`, `email_verification_status`, `lifecycle`  
- `limit` / `cursor` — **never** unbounded  

Aggregates (book strip): total, valid_email, sequence_ready, load_eligible, in_instantly, by_campaign_loads, hvac_share_of_book, states_in_last_30d_loads.

---

## 10. Success criteria (exit this phase)

- [ ] ≥1 non-HVAC campaign with sends > 0 and bounce known  
- [ ] HVAC Nat’l: fix **or** pause documented  
- [ ] CRM default never shows full scrapes  
- [ ] Load GO never runs without checklist  
- [ ] Cold call still paused unless founder GO **after** multi-vertical email works  
- [ ] Reply SLA instrumented  

---

## 11. Sandbox deliverables this pass

1. Finalized this plan  
2. Load GO board (campaign readiness + checklist + simulate load)  
3. `sequence-queries` predicate contract  
4. Agent strip prefers load-eligible  
5. Migration doc updated for sequence-first  

*Prod ops W1+ still require live SQL + n8n — not executed from this sandbox.*
