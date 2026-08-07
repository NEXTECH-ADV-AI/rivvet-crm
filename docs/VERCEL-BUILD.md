# Vercel build (rivvet-crm)

In-repo: [`vercel.json`](../vercel.json)

---

## Env (copy from `crm-rivvetai`)

| Name | Required |
|------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** for LIVE pipeline |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional (defaults to platform) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional (defaults to platform) |
| `CRM_BASE_URL` | Optional (`https://crm.rivvetai.com`) |
| `CRM_DATA_SOURCE` | Optional force `live` \| `mock` — leave unset |

Do **not** force `CRM_DATA_SOURCE=mock` if you want real opps.

Same pattern as ops/command: secrets on the Vercel project, never in git.

---

## Thin bootstrap deploy

Vercel project may use a thin entry that clones GitHub `main` and builds. Source of truth is this repo’s `npm run build` → Nitro `.vercel/output`.
