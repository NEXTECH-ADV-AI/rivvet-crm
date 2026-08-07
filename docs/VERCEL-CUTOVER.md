# Rivvet CRM — sibling project + domain cutover

Same process as **ops/command**: ship a sibling Vercel project → exercise full product E2E → flip DNS when green. Production CRM (`crm-rivvetai` / `crm.rivvetai.com`) stays untouched until cutover.

## Live now

| | |
|--|--|
| **App** | [https://rivvet-crm-rivvetai.vercel.app](https://rivvet-crm-rivvetai.vercel.app) |
| **Also** | [https://rivvet-crm.vercel.app](https://rivvet-crm.vercel.app) |
| **Dashboard** | [vercel.com/rivvetai/rivvet-crm](https://vercel.com/rivvetai/rivvet-crm) |
| **Source** | [github.com/NEXTECH-ADV-AI/rivvet-crm](https://github.com/NEXTECH-ADV-AI/rivvet-crm) |
| **Mode** | LIVE when `SUPABASE_SERVICE_ROLE_KEY` is set; otherwise MOCK seed |
| **Auth on deploy** | Public (SSO off for pre-DNS testing) |
| **Production CRM** | `crm-rivvetai` unchanged |

Deploy: thin Vercel bootstrap clones GitHub `main` → `npm run build` → Nitro `.vercel/output`.

---

## Connect LIVE (ops/command pattern)

On **`rivvet-crm`** env (Production + Preview), copy from **`crm-rivvetai`**:

| Variable | Required |
|----------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** — anon cannot read `crm_opportunities` |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional (platform default) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional (platform default) |
| `CRM_DATA_SOURCE` | Do **not** set to `mock` |

Redeploy. Chip flips to **LIVE**. Stage patches write to `crm_opportunities`.

See [TEAM_SHARE.md](../TEAM_SHARE.md).

---

## E2E test checklist (pre-DNS)

Open [rivvet-crm-rivvetai.vercel.app](https://rivvet-crm-rivvetai.vercel.app).

| Surface | What to try | Expect |
|---------|-------------|--------|
| **Home** | Today queue, load-eligible, book KPIs | Real book when LIVE |
| **Leads** | Filters, detail, next action | LIVE `gtm_leads` or seed |
| **Sequences** | Vertical boards, Load GO | Sim only (n8n locked) |
| **Accounts** | List + detail | LIVE accounts + contacts |
| **Opportunities** | Kanban drag / stage change | LIVE `crm_opportunities` |
| **Opp workspace** | Deal builder commerce catalog | Local price calc; no PandaDoc/Stripe |
| **Send** | Contract send path | **Locked** |
| **Activities** | Timeline / complete | LIVE or seed |
| **Analytics** | GTM widgets | Counts from hydrated book |
| **Settings** | Wire status + connect checklist | service_role ✓ |

Sacred (never reimplemented here): Instantly Load GO (n8n), PandaDoc send, Stripe, `crm_create_contract_draft`.

---

## Projects

| Project | Role |
|---------|------|
| **`crm-rivvetai`** | Live production CRM — leave alone |
| **`rivvet-crm`** | New FE rewrite (this app) |
| **ops/command** | Separate product |

---

## Domain cutover (when green)

1. Confirm E2E checklist on `rivvet-crm-*.vercel.app` with **LIVE** chip
2. Point `crm.rivvetai.com` → **`rivvet-crm`**
3. Keep `crm-rivvetai` as rollback alias for 48h
4. Re-enable Vercel SSO if desired after cutover
