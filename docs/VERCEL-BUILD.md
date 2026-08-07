# Vercel build settings — Rivvet CRM

**Sibling project (new FE):** [`rivvet-crm`](https://vercel.com/rivvetai/rivvet-crm)  
**Production (leave until cutover):** `crm-rivvetai`  
**Cutover plan:** [VERCEL-CUTOVER.md](./VERCEL-CUTOVER.md)

| | |
|--|--|
| Team | `rivvetai` |
| New project ID | `prj_njbMjOT0iRhYwviTmJgUKZhTd9K8` |
| Preview | https://rivvet-crm-rivvetai.vercel.app |

---

## Build settings (`rivvet-crm`)

| Setting | Value |
|---------|--------|
| Framework | **Vite** |
| Build | `npm run build` |
| Output | **empty** for full TanStack/Nitro app · bootstrap placeholder used `dist` |
| Install | `npm install` |
| Node | **22.x** |

In-repo: [`vercel.json`](../vercel.json)

---

## Env (copy from `crm-rivvetai`)

`NEXT_PUBLIC_SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `CRM_BASE_URL`
