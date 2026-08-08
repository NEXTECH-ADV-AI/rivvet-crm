# Rivvet CRM — team share (LIVE data + magic link)

## Live project (DNS cut over)

| | |
|--|--|
| **Canonical** | https://crm.rivvetai.com |
| **Vercel** | [rivvet-crm](https://vercel.com/rivvetai/rivvet-crm) |
| **Aliases** | https://rivvet-crm-rivvetai.vercel.app · https://rivvet-crm.vercel.app |
| **GitHub** | https://github.com/NEXTECH-ADV-AI/rivvet-crm |
| **Do not confuse with** | app.rivvetai.com (other product — Supabase Site URL) |

## Wire real pipeline (if opps look wrong)

Seed opps are **MOCK**. Real `crm_opportunities` need **service_role** on **rivvet-crm**:

1. Vercel → **crm-rivvetai** → Environment Variables  
2. Copy `SUPABASE_SERVICE_ROLE_KEY` (and optional Supabase URL/anon)  
3. Paste onto **rivvet-crm** (Production + Preview)  
4. Confirm **no** `CRM_DATA_SOURCE=mock`  
5. **Redeploy** Production  

## Magic link login

Supabase Auth OTP → email via **Resend inside Supabase** (no `RESEND_API_KEY` on Vercel) → `/auth/callback` on **crm.rivvetai.com** → Better Auth session.

### Supabase Redirect URLs (required)

Project `jgsghtfpejxbcdmolvsp` → Authentication → URL configuration:

- `https://crm.rivvetai.com/auth/callback`
- `https://crm.rivvetai.com/auth/callback/**`
- `https://rivvet-crm-rivvetai.vercel.app/auth/callback`
- `https://rivvet-crm-rivvetai.vercel.app/auth/callback/**`
- `https://rivvet-crm.vercel.app/auth/callback`
- `https://rivvet-crm.vercel.app/auth/callback/**`
- `http://localhost:8080/auth/callback`
- `http://localhost:8080/auth/callback/**`

Optional on Vercel env: `BETTER_AUTH_URL=https://crm.rivvetai.com` and `CRM_PUBLIC_URL=https://crm.rivvetai.com`.

### After code ships

Login must show **WORK EMAIL** + **EMAIL ME A MAGIC LINK**. If you only see “ENTER CRM SANDBOX” + Google/X, production is still on an **old deploy** — Redeploy `main` on rivvet-crm.

Request a **new** magic link after each allowlist/deploy change (old emails keep the old redirect).

## Sacred (never reimplement)
Instantly Load GO (n8n) · PandaDoc send · Stripe · `crm_create_contract_draft`
