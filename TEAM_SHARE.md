# Rivvet CRM — team share (LIVE data + magic link)

Same ops/command standup path: sibling Vercel project → copy secrets → redeploy → E2E → DNS later.

## Live project
- **Vercel:** [rivvet-crm](https://vercel.com/rivvetai/rivvet-crm)
- **URL:** https://rivvet-crm-rivvetai.vercel.app
- **GitHub:** https://github.com/NEXTECH-ADV-AI/rivvet-crm
- **Production CRM (leave alone):** crm-rivvetai / crm.rivvetai.com
- **Do not confuse with:** app.rivvetai.com (other Rivvet product — Supabase Site URL)

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

## Magic link login (Supabase + Resend inside Supabase)

Operators sign in with email magic link. **No `RESEND_API_KEY` on Vercel** — Resend is configured in the Supabase project (Auth → SMTP / email).

Flow: app → Supabase OTP (`?redirect_to=`) → Supabase emails via Resend → `/auth/callback` on **rivvet-crm** → Better Auth session.

### Why the email opened app.rivvetai.com (fixed in app)

1. GoTrue only honors **`redirect_to` as a query param** on `/auth/v1/otp`. Body fields are ignored.
2. If redirect is missing or **not on the allowlist**, Supabase falls back to project **Site URL** (= app.rivvetai.com).
3. The app now always bakes  
   `https://rivvet-crm-rivvetai.vercel.app/auth/callback?next=/home`  
   (or the current rivvet-crm / localhost origin when trusted). Sandbox origins are rewritten so they never fall through to Site URL.

### Supabase Auth URL allowlist (required — do this once)

Project `jgsghtfpejxbcdmolvsp` → Authentication → URL configuration:

| Field | Value |
|---|---|
| **Redirect URLs** (add all) | `https://rivvet-crm-rivvetai.vercel.app/auth/callback` |
| | `https://rivvet-crm-rivvetai.vercel.app/auth/callback/**` |
| | `https://rivvet-crm.vercel.app/auth/callback` |
| | `https://rivvet-crm.vercel.app/auth/callback/**` |
| | `https://crm.rivvetai.com/auth/callback` |
| | `https://crm.rivvetai.com/auth/callback/**` |
| | `http://localhost:8080/auth/callback` |
| | `http://localhost:8080/auth/callback/**` |

**Do not** change Site URL away from app.rivvetai.com if other products need it — just keep the redirects above. After allowlisting, request a **new** magic link (old emails still point at the old redirect).

### Email template (if links still ignore redirect)

Auth → Email templates → Magic Link / Confirm signup: the button must use  
`{{ .ConfirmationURL }}` (includes `redirect_to`), **not** a hard-coded `{{ .SiteURL }}` only.

Optional: show `{{ .RedirectTo }}` in the body for debugging.

### Sandbox preview links

When `SUPABASE_SERVICE_ROLE_KEY` is available outside Vercel production, the login UI can generate an action link (no email hop). Production always emails.

## Why MOCK still shows in Grok / sibling
- Anon key gets **401** on `crm_opportunities` / `accounts` (RLS)
- Sandbox has **no** Vercel secrets
- Vercel MCP cannot set env vars — only dashboard (or paste key in chat once)

## Sacred (never reimplement)
Instantly Load GO (n8n) · PandaDoc send · Stripe · `crm_create_contract_draft`
