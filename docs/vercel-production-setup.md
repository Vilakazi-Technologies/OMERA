# Vercel production setup (Omera + Shivani / Xavani + Supabase)

Use this after you are invited to the Supabase project (e.g. **vilatech17@gmail.com**).

## 1. Set variables (Production)

Open: [vilatech-ai → Settings → Environment Variables](https://vercel.com/ayanda-vilakazis-projects/vilatech-ai/settings/environment-variables)

| Variable | Where to get it | Notes |
|----------|-----------------|-------|
| `APP_ORIGIN` | You | `https://vilatech-ai.vercel.app` (exact, no trailing slash) |
| `OMERA_DEMO_MODE` | You | `false` on production |
| `XAVANI_BASE_URL` | Shivani / XAVANI team | Optional if using OpenRouter below |
| `XAVANI_API_KEY` | Shivani / XAVANI team | Optional; takes priority over OpenRouter when set |
| `XAVANI_MODEL` | Shivani / XAVANI team | e.g. `omera` |
| `OPENROUTER_API_KEY` | [OpenRouter](https://openrouter.ai/keys) | Developer-provided; server only |
| `OPENROUTER_MODEL` | Developer | MVP: `google/gemini-2.0-flash-lite-preview-02-05:free` (see `docs/shivani-mvp-production.md`) |
| `LELAPA_API_KEY` | Lelapa dashboard | Voice transcription (optional but needed for mic) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) | Public |
| `CLERK_SECRET_KEY` | Clerk Dashboard | **Server only** |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | You | `/login` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | You | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | You | `/chat` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | You | `/chat` |
| `SUPABASE_URL` | Supabase → API (optional) | Cloud sync for chats/forms only |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → service_role (optional) | **Server only** — not used for login |

Redeploy after saving (Deployments → … → Redeploy, or push to `main` when Git is connected).

## 2. Supabase (database)

1. In [Supabase Dashboard](https://supabase.com/dashboard), open the Omera project you were invited to.
2. Run migrations from this repo (SQL editor or CLI), in order:
   - `supabase/migrations/20261005100000_omera_platform.sql`
   - `supabase/migrations/20261014090000_omera_identity.sql`
   - `supabase/migrations/20261014091000_omera_request_limits.sql`
   - `supabase/migrations/20261014092000_omera_form_documents.sql`
3. Run `20261017000000_clerk_identity.sql` so `omera_users.auth_user_id` stores Clerk ids.
4. Login is **Clerk only** — do not enable Supabase Auth for Omera.

## 3. Chat model (Xavani or OpenRouter)

**Priority:** If `XAVANI_*` is set, Omera uses the Xavani runtime. Otherwise, if `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are set, chat and form translation use [OpenRouter](https://openrouter.ai/) (e.g. `nvidia/nemotron-3.5-super-vl:free`).

`/api/health` includes `chat.provider`: `"xavani"`, `"openrouter"`, or `null`.

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
