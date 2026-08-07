# Rivvet CRM — sibling project + domain cutover

Same process as **ops/command**: ship a sibling Vercel project → exercise full product E2E → flip DNS when green. Production CRM (`crm-rivvetai` / `crm.rivvetai.com`) stays untouched until cutover.

## Live now (Option A — MOCK · E2E ready)

| | |
|--|--|
| **App** | [https://rivvet-crm-rivvetai.vercel.app](https://rivvet-crm-rivvetai.vercel.app) |
| **Also** | [https://rivvet-crm.vercel.app](https://rivvet-crm.vercel.app) |
| **Dashboard** | [vercel.com/rivvetai/rivvet-crm](https://vercel.com/rivvetai/rivvet-crm) |
| **Source** | [github.com/NEXTECH-ADV-AI/rivvet-crm](https://github.com/NEXTECH-ADV-AI/rivvet-crm) (public) |
| **Mode** | **MOCK** seed — full UI/state without Supabase secrets |
| **Auth on deploy** | Public (SSO off for pre-DNS testing) |
| **Production CRM** | `crm-rivvetai` unchanged |

Deploy: thin Vercel bootstrap clones GitHub `main` → `npm run build` → Nitro `.vercel/output`. `CRM_DATA_SOURCE=mock`.

---

## E2E test checklist (pre-DNS)

Open [rivvet-crm-rivvetai.vercel.app](https://rivvet-crm-rivvetai.vercel.app) — expect **MOCK** chip + hydrate banner.

| Surface | What to try | Expect |
|---------|-------------|--------|
| **Home** | Today queue, load-eligible, book KPIs | Seeded leads/opps/accounts, multi-vertical strip |
| **Leads** | Filters, detail, next action | Editable next step (local store) |
| **Sequences** | Vertical boards, Load GO | Sim only (n8n locked) — toast/count updates |
| **Accounts** | List + detail | Hydrated book; contacts on detail |
| **Opportunities** | Kanban drag / stage change | Stage moves in UI (MOCK local; LIVE patches Supabase) |
| **Opp workspace** | Deal builder commerce catalog | Local price calc; no PandaDoc/Stripe fire |
| **Send** | Contract send path | **Locked** — sacred revenue on production only |
| **Activities** | Timeline / complete | Local complete + notes |
| **Analytics** | GTM widgets | Counts from hydrated book |
| **Settings** | E2E readiness + wire status | Counts, ready/locked matrix, env presence |

Sacred (never reimplemented here): Instantly Load GO (n8n), PandaDoc send, Stripe, `crm_create_contract_draft`.

---

## Projects

| Project | Role |
|---------|------|
| **`crm-rivvetai`** | Live production CRM — leave alone |
| **`rivvet-crm`** | New FE rewrite (this app) |
| **ops/command** | Separate product |

---

## Later: LIVE data (optional, still pre-DNS)

On **`rivvet-crm`** env (Production + Preview):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Set `CRM_DATA_SOURCE` to `live` (or remove mock override)

Redeploy. Chip flips to **LIVE**. Stage patches write to `crm_opportunities`.

---

## Domain cutover (when green)

1. Confirm E2E checklist above on `rivvet-crm-*.vercel.app`
2. Point `crm.rivvetai.com` → **`rivvet-crm`**
3. Keep `crm-rivvetai` as rollback alias for 48h
4. Re-enable Vercel SSO if desired after cutover
