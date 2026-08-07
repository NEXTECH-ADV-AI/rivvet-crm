# Rivvet CRM — sibling project + domain cutover

Same pattern as **ops/command**: new Vercel project first, domain later.

---

## Why a sibling project

| Project | Role |
|---------|------|
| **`crm-rivvetai`** | Production CRM today — leave running |
| **`rivvet-crm`** | New FE rewrite (this workspace) — preview / QA / LIVE wire |
| **ops/command** | Separate product (`rivvet-ops-command`) — not CRM |

Domain **`crm.rivvetai.com`** stays on production until this FE is green.

---

## What exists now

| Item | Value |
|------|--------|
| Team | `rivvetai` |
| Project | **`rivvet-crm`** |
| Project ID | `prj_njbMjOT0iRhYwviTmJgUKZhTd9K8` |
| Framework | Vite |
| Alias | https://rivvet-crm-rivvetai.vercel.app |
| Also | https://rivvet-crm.vercel.app |

Bootstrap deploy is live (placeholder page). **Full CRM FE** still needs a full deploy + env.

---

## Your steps (short)

### 1. Copy env from `crm-rivvetai` → `rivvet-crm`

Vercel → **rivvet-crm** → Settings → Environment Variables  
Copy (Production + Preview):

```
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
CRM_BASE_URL=https://crm.rivvetai.com
```

(I cannot read secret values from the other project — you copy once in dashboard, or “Link Shared Env” if you use that.)

### 2. Ship full CRM FE to `rivvet-crm`

- Connect Git repo to **rivvet-crm**, root = this app, **or**
- Redeploy full tree from this workspace (next agent turn once env is set)

Build settings: Vite · `npm run build` · **empty** output dir for Nitro full app (bootstrap used `dist` only for the placeholder).

### 3. QA on sibling URL

- Header **LIVE**
- Leads = real `gtm_leads`
- Deal send still locked

### 4. Domain cutover (when green)

1. `crm.rivvetai.com` → point to **`rivvet-crm`**
2. Keep `crm-rivvetai` as rollback for 1–2 weeks
3. Update `CRM_BASE_URL` if needed

---

## Why this wasn’t done by rewriting `crm-rivvetai` in place

Would take down live CRM mid-flight. Sibling = zero downtime path (ops/command style).
