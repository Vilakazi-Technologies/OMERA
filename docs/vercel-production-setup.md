# Vercel production setup (Omera + Shivani / Xavani + Supabase)

Use this after you are invited to the Supabase project (e.g. **vilatech17@gmail.com**).

## 1. Set variables (Production)

Open: [vilatech-ai → Settings → Environment Variables](https://vercel.com/ayanda-vilakazis-projects/vilatech-ai/settings/environment-variables)

| Variable | Where to get it | Notes |
|----------|-----------------|-------|
| `APP_ORIGIN` | You | `https://vilatech-ai.vercel.app` (exact, no trailing slash) |
| `OMERA_DEMO_MODE` | You | `false` on production |
| `XAVANI_BASE_URL` | Shivani / XAVANI team | HTTPS origin only, e.g. `https://your-xavani-host/` → stored as origin |
| `XAVANI_API_KEY` | Shivani / XAVANI team | Server secret; never `NEXT_PUBLIC_` |
| `XAVANI_MODEL` | Shivani / XAVANI team | Default in code: `omera` — must match service capabilities |
| `LELAPA_API_KEY` | Lelapa dashboard | Voice transcription (optional but needed for mic) |
| `SUPABASE_URL` | Supabase → Project Settings → API | Same as project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → service_role | **Server only** |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` | Browser auth client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → anon public | Browser auth client |

Redeploy after saving (Deployments → … → Redeploy, or push to `main` when Git is connected).

## 2. Supabase (database)

1. In [Supabase Dashboard](https://supabase.com/dashboard), open the Omera project you were invited to.
2. Run migrations from this repo (SQL editor or CLI), in order:
   - `supabase/migrations/20261005100000_omera_platform.sql`
   - `supabase/migrations/20261014090000_omera_identity.sql`
   - `supabase/migrations/20261014091000_omera_request_limits.sql`
   - `supabase/migrations/20261014092000_omera_form_documents.sql`
3. Enable **Email** auth (OTP) if login should work for real users.

## 3. Shivani model (Xavani)

Chat does **not** call OpenAI from this app. It calls the **Xavani** service, which runs your configured model.

The client checks `/v1/capabilities` and expects `service.name === "omera"`, `model` matching `XAVANI_MODEL`, and a restricted contract (stateless, no tools/memory). If chat fails with configuration errors, Shivani should confirm base URL, API key, and model id on the Xavani side.

## 4. Verify production

```text
GET https://vilatech-ai.vercel.app/api/health
```

| `status` | Meaning |
|----------|---------|
| `unavailable` | Missing `XAVANI_*` (and/or demo mode mis-set) |
| `degraded` | Xavani configured but database not reachable (wrong keys, migrations not applied, or network) |
| `ok` | Xavani configured and database probe succeeded |

`chat.inference` stays `unverified` until someone runs a live chat test — that is intentional.

## 5. Smoke test (optional)

From a machine with env in `.env.local`:

```bash
npm run smoke
```

See `scripts/smoke.mjs` and `docs/operations.md`.

## 6. Git auto-deploy

Connect repo: [Project Git settings](https://vercel.com/ayanda-vilakazis-projects/vilatech-ai/settings/git) → **Vilakazi-Technologies/OMERA**, production branch **`main`**.
