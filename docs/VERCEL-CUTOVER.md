# Rivvet CRM — domain cutover

## Live now

| | |
|--|--|
| **Canonical** | [https://crm.rivvetai.com](https://crm.rivvetai.com) |
| **Vercel project** | [rivvet-crm](https://vercel.com/rivvetai/rivvet-crm) |
| **Aliases** | [rivvet-crm-rivvetai.vercel.app](https://rivvet-crm-rivvetai.vercel.app) · [rivvet-crm.vercel.app](https://rivvet-crm.vercel.app) |
| **Source** | [github.com/NEXTECH-ADV-AI/rivvet-crm](https://github.com/NEXTECH-ADV-AI/rivvet-crm) |
| **Mode** | LIVE when `SUPABASE_SERVICE_ROLE_KEY` is set; otherwise MOCK seed |
| **Legacy project** | `crm-rivvetai` — leave until fully retired |

DNS: `crm.rivvetai.com` → Vercel DNS for **rivvet-crm** (confirmed).

Deploy: thin bootstrap clones GitHub `main` → `npm run build` → Nitro `.vercel/output`. **Redeploy after magic-link landings** so `/login` shows WORK EMAIL.

## Env (Production + Preview on rivvet-crm)

| Variable | Required |
|----------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** for LIVE pipeline |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional (platform default) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional |
| `BETTER_AUTH_URL` | Recommended: `https://crm.rivvetai.com` |
| `CRM_PUBLIC_URL` | Optional same as above (magic-link rewrite target) |
| `CRM_DATA_SOURCE` | Do **not** set to `mock` |

## Magic link

See [TEAM_SHARE.md](../TEAM_SHARE.md). Supabase allowlist must include  
`https://crm.rivvetai.com/auth/callback` (+ `/**`).

## E2E (post-DNS)

| Surface | Expect |
|---------|--------|
| https://crm.rivvetai.com/login | WORK EMAIL + magic link CTA |
| Magic link email | Opens crm.rivvetai.com/auth/callback → /home |
| Opps / leads | LIVE when service_role set |

Sacred: Instantly Load GO · PandaDoc · Stripe · `crm_create_contract_draft`.
