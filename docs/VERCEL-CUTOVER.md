# Rivvet CRM — sibling project + domain cutover

## Live now (Option A — MOCK)

| | |
|--|--|
| **App** | [https://rivvet-crm-rivvetai.vercel.app](https://rivvet-crm-rivvetai.vercel.app) |
| **Also** | [https://rivvet-crm.vercel.app](https://rivvet-crm.vercel.app) |
| **Dashboard** | [vercel.com/rivvetai/rivvet-crm](https://vercel.com/rivvetai/rivvet-crm) |
| **Source** | [github.com/NEXTECH-ADV-AI/rivvet-crm](https://github.com/NEXTECH-ADV-AI/rivvet-crm) (public) |
| **Mode** | **MOCK** seed data — no Supabase secrets required |
| **Production CRM** | `crm-rivvetai` unchanged |

Deploy uses a thin Vercel bootstrap that clones the GitHub repo at build time, builds Nitro, promotes `.vercel/output`. `CRM_DATA_SOURCE` defaults to **mock**.

---

## Projects

| Project | Role |
|---------|------|
| **`crm-rivvetai`** | Live production CRM — leave alone |
| **`rivvet-crm`** | New FE rewrite |
| ops/command | Separate product |

---

## Later: LIVE data

When you want real `gtm_leads`, add Supabase env on **`rivvet-crm`** (or shared team env). Redeploy. Chip flips to **LIVE**.

---

## Domain cutover (when green)

Point `crm.rivvetai.com` → **`rivvet-crm`**. Keep `crm-rivvetai` as rollback.
