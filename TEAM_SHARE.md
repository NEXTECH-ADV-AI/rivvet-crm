# Rivvet CRM — team share (LIVE data)

Same ops/command standup path: sibling Vercel project → copy secrets → redeploy → E2E → DNS later.

## Live project
- **Vercel:** [rivvet-crm](https://vercel.com/rivvetai/rivvet-crm)
- **URL:** https://rivvet-crm-rivvetai.vercel.app
- **GitHub:** https://github.com/NEXTECH-ADV-AI/rivvet-crm
- **Production CRM (leave alone):** crm-rivvetai / crm.rivvetai.com

## Wire real pipeline (2 minutes) — required for correct opps

Seed opps (`O-881` Summit Fleet, etc.) are **MOCK**. Real `crm_opportunities` need **service_role**.

1. Vercel → **crm-rivvetai** → Settings → **Environment Variables**
2. Copy:
   - `SUPABASE_SERVICE_ROLE_KEY` ← **required**
   - `NEXT_PUBLIC_SUPABASE_URL` (optional — platform default is fine)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional — platform default is fine)
3. Paste onto **rivvet-crm** (Production + Preview)
4. Confirm **no** `CRM_DATA_SOURCE=mock` on rivvet-crm
5. Redeploy Production

Same step as ops/command copying `LINEAR_API_KEY` from ops-rivvetai → rivvet-ops-command.

## Why MOCK still shows in Grok / sibling
- Anon key gets **401** on `crm_opportunities` / `accounts` (RLS)
- Sandbox has **no** Vercel secrets
- Vercel MCP cannot set env vars — only dashboard (or paste key in chat once)

## Sacred (never reimplement)
Instantly Load GO (n8n) · PandaDoc send · Stripe · `crm_create_contract_draft`
