# Rivvet CRM → Vercel `crm-rivvetai` + Supabase

**Product:** Rivvet **CRM** (`crm.rivvetai.com`) — not ops/command.  
**Vercel:** team `rivvetai` · project **`crm-rivvetai`**  
**Build settings:** [VERCEL-BUILD.md](./VERCEL-BUILD.md) · [`vercel.json`](../vercel.json)

---

## Env contract (production CRM / crm-rivvetai)

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | PostgREST base |
| `SUPABASE_SERVICE_ROLE_KEY` | Server `gtm_leads` (preferred) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fallback |
| `CRM_BASE_URL` | `https://crm.rivvetai.com` |
| `CRM_DATA_SOURCE` | optional force `live` \| `mock` |

---

## Build (summary)

| Setting | Value |
|---------|--------|
| Framework | **Vite** (this rewrite) |
| Build | `npm run build` |
| Output | *(auto — Nitro `.vercel/output`)* |
| Install | `npm install` |
| Node | **22.x** |

**Do not** set output to `dist`. See [VERCEL-BUILD.md](./VERCEL-BUILD.md).

---

## Runtime

| Host | Mode |
|------|------|
| Grok sandbox | MOCK |
| Vercel CRM with env | LIVE |

---

## Locked

Instantly Load GO · sendContract / PandaDoc · Stripe · `crm_create_contract_draft`
