# Phase 3 — production push, health/models, and Shivani (Xavani) final hook-up

**For:** Andy (hosting / Xavani + domain) and Ayanda (Vercel + product)  
**Repo:** [github.com/Vilakazi-Technologies/OMERA](https://github.com/Vilakazi-Technologies/OMERA)  
**Branch:** `feat/omera-integration` (latest Phase 3 commit on this branch)  
**Live app:** [https://vilatech-ai.vercel.app](https://vilatech-ai.vercel.app)

Send Andy this file (or link to it on GitHub) after the push. **Phase 3 is “Omera on Vercel is ready; we only need Shivani’s own AI gateway on a public URL.”**

---

## 1. What was pushed in Phase 3 (summary for GitHub / WhatsApp)

| Area | What changed |
|------|----------------|
| **Auth** | **Clerk only** (sign-in / sign-up). Removed legacy Supabase email OTP routes. |
| **Chat** | Retries, thinking indicator, delete chat + confirm dialog, stream abort on leave, clearer errors. |
| **Models** | Catalog API; UI label **Omera (Shivani)**; routing via Xavani **or** OpenRouter fallback. |
| **Forms** | Required fields first, better errors, client blocks incomplete export; server fills **AcroForm** PDFs with pdf-lib. |
| **Ops** | `/api/health` and `/api/ai/models` for demos and integration checks. |
| **Docs** | MVP demo script, Vercel env table, Clerk + Supabase migration notes. |
| **Tests** | Full suite green (634+ tests); jsdom pinned for Node 20 CI/dev. |

**Commit message on branch:** `Ship MVP supercharge: Clerk auth, chat reliability, forms, and demo docs` (and this Phase 3 doc in the follow-up commit).

---

## 2. What production uses **today** (interim AI)

Until Andy links **hosted Xavani**, chat and form-label AI go through **OpenRouter**, not Shivani’s standalone stack.

| Setting (Vercel) | Typical MVP value |
|------------------|-------------------|
| `OPENROUTER_API_KEY` | Server-only key from OpenRouter |
| `OPENROUTER_MODEL` | **`google/gemini-2.0-flash-lite-preview-02-05:free`** (Gemini **2.0** Flash Lite — fast, low-cost demo) |

The product still shows the primary model as **Omera (Shivani)** in the UI and APIs. Under the hood, `chat.provider` is `"openrouter"` until `XAVANI_*` is set.

**Not Java** — the interim model id is **Google Gemini 2.0 Flash Lite** on OpenRouter (free tier). Shivani’s **own** model runs **inside Xavani** once that service is hosted.

---

## 3. Health API — how to verify production

```http
GET https://vilatech-ai.vercel.app/api/health
```

Example shape (values depend on env):

```json
{
  "status": "ok",
  "service": "omera",
  "chat": {
    "configured": true,
    "state": "configured",
    "provider": "openrouter",
    "primaryModel": "omera",
    "primaryLabel": "Omera (Shivani)"
  },
  "voice": { "configured": true },
  "forms": { "storage": true, "ai": true },
  "database": { "configured": true, "reachable": true }
}
```

| Field | Meaning |
|-------|---------|
| `status` | `ok` = demo-ready; `unavailable` = fix env (see Vercel) |
| `chat.provider` | **`xavani`** = Shivani gateway linked (goal). **`openrouter`** = interim. |
| `chat.primaryLabel` | Should stay **Omera (Shivani)** for branding |
| `forms.storage` | Supabase configured (needed for form upload/export) |
| `forms.ai` | Chat runtime configured (OpenRouter or Xavani) |
| `database.reachable` | Supabase probe to `omera_conversations` |

---

## 4. Models API — what the app and demos read

```http
GET https://vilatech-ai.vercel.app/api/ai/models
```

Returns `provider` (`openrouter` or `xavani`) and `models[]` with `kind: "primary"` for **Omera (Shivani)** plus optional extension models.

After Xavani is linked, `provider` becomes `xavani`; primary id stays **`omera`** (alias configured on the Xavani side).

---

## 5. What we actually want — Shivani’s AI system (Andy’s job)

Omera is already built to talk to **Xavani**: Shivani’s **own** AI gateway (stateless Omera contract, provider keys live **on Xavani**, not in the Next.js app).

**We do not need more app code for “use Shivani model.”** We need:

1. **Xavani deployed** on infrastructure Andy controls (see `enternovate/xavani-agent`, branch `feat/omera-api-mode`, `omera_mode: true`).
2. **Underlying model** configured **inside Xavani** (OpenRouter, local, or Shivani’s model — Andy/Shivani’s choice).
3. A **public HTTPS origin** (domain or subdomain) pointing to that Xavani API, e.g. `https://omera-api.shivani.example/`  
   - Path must be **`/`** on that host (Omera calls `{origin}/v1/chat/completions` and `{origin}/v1/capabilities`).
4. **Service API key** — same value as Xavani `API_SERVER_KEY` (long random secret).

Andy sends Ayanda **two values** (WhatsApp/email is fine; rotate if leaked):

| Deliverable | Env var on Vercel (Production) |
|-------------|--------------------------------|
| HTTPS base URL, no trailing path junk | `XAVANI_BASE_URL` → e.g. `https://your-domain.com/` |
| Service key | `XAVANI_API_KEY` |
| Model alias (fixed) | `XAVANI_MODEL` → `omera` |

Ayanda adds those three on Vercel → **Redeploy** → confirm:

```http
GET https://vilatech-ai.vercel.app/api/health
```

`chat.provider` must be **`"xavani"`**.

Optional: remove or keep `OPENROUTER_*` as emergency fallback (app prefers Xavani when `XAVANI_*` is complete).

**Local reference for Andy:** `docs/setting-up-omera.md`, `scripts/setup-xavani-windows.ps1`, `XAVANI-INSTRUCTIONS.md`.

---

## 6. Andy checklist (copy for WhatsApp)

- [ ] Xavani running with Omera contract (`GET /v1/capabilities` → `service.name: "omera"`, tools/memory off).
- [ ] Shivani model / provider wired **inside Xavani** only.
- [ ] **Domain or subdomain** with valid TLS → public `XAVANI_BASE_URL`.
- [ ] Send Ayanda `XAVANI_BASE_URL` + `XAVANI_API_KEY` (+ confirm `XAVANI_MODEL=omera`).
- [ ] Ayanda redeploys Vercel; health shows `provider: "xavani"`.
- [ ] Smoke: sign in at [vilatech-ai.vercel.app/chat](https://vilatech-ai.vercel.app/chat) → three business questions → answers in reasonable time.

---

## 7. Ayanda checklist (already done in Phase 3 unless noted)

- [x] Code on `feat/omera-integration`, deployed to [vilatech-ai.vercel.app](https://vilatech-ai.vercel.app).
- [x] Clerk, Supabase, OpenRouter (Gemini 2.0 Flash Lite free) on Vercel.
- [ ] Apply Supabase migration `20261017000000_clerk_identity.sql` if not already on production DB.
- [ ] After Andy’s URL: set `XAVANI_*` and redeploy.
- [ ] Merge `feat/omera-integration` → `main` when stakeholders sign off.

---

## 8. Related docs (same repo)

| Doc | Use |
|-----|-----|
| **This file** | Phase 3 handover + Andy domain/Xavani steps |
| [`shivani-mvp-production.md`](./shivani-mvp-production.md) | MVP scope, env table, PDF troubleshooting |
| [`mvp-demo.md`](./mvp-demo.md) | 5-minute investor demo script |
| [`vercel-production-setup.md`](./vercel-production-setup.md) | Full Vercel env list |
| [`clerk-auth.md`](./clerk-auth.md) | Clerk-only auth |
| [`../XAVANI-INSTRUCTIONS.md`](../XAVANI-INSTRUCTIONS.md) | Product vision and P0s for Shivani |

---

## 9. Suggested WhatsApp to Andy

> Hi Andy — Phase 3 of Omera is pushed to GitHub (`feat/omera-integration` on Vilakazi-Technologies/OMERA). Live site: vilatech-ai.vercel.app.  
> Please read **`docs/PHASE-THREE-instructions.md`** — we only need you to host Xavani (Shivani’s AI gateway) on a **public HTTPS domain** and send me `XAVANI_BASE_URL` + `XAVANI_API_KEY`. Omera already calls that API; no new app work. Until then we’re on OpenRouter Gemini 2.0 Flash Lite for demos. Health check: vilatech-ai.vercel.app/api/health — goal is `chat.provider: "xavani"`.

---

*Phase 3 — updated when Xavani production URL is live.*
