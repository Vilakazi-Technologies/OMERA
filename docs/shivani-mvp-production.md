# Shivani / Xavani — MVP production handover (investor demo, low spend)

**Audience:** Shivani, Xavani developers, and Vilakazi engineers finishing the AI layer.  
**Product:** [Omera](https://vilatech-ai.vercel.app) — MVP for investors, **not** full production scale yet.  
**Goal:** Reliable **chat** demo + credible **form fill** path without large spend. Tokens/hosting are the only variable cost.

Also read: [`docs/mvp-demo.md`](./mvp-demo.md) (5‑minute demo script), [`docs/vercel-production-setup.md`](./vercel-production-setup.md) (env table).

---

## 1. What “MVP done” means (Ayanda)

| Must work for investors | Nice to have later |
|-------------------------|-------------------|
| Sign in / sign up (Clerk) | All 11 languages voice-perfect |
| Chat as **Omera (Shivani)** business adviser | Extension models in production |
| Stable streaming + thinking state + retry | Custom fine-tuned model |
| Form upload → Q&A → **download filled PDF** (on supported PDFs) | Every scanned PDF without templates |
| Honest branding (VILATECH / Omera) | Lorraine Butte |

**Spend expectation:** Clerk + Vercel + Supabase free tiers; **OpenRouter free or ~$5 credit** for demo week; **hosted Xavani** when Shivani’s team provides it (provider keys live on Xavani, not in Omera).

---

## 2. Current production architecture (today)

```
User → Clerk (auth only)
     → Next.js on Vercel (vilatech-ai)
           → Chat: Xavani if XAVANI_* set, else OpenRouter (OPENROUTER_*)
           → Forms: Supabase storage + DB; AI translates field labels (same chat runtime)
           → Export: pdf-lib fills AcroForm PDFs on the server (no extra API $)
```

Check:

```http
GET https://vilatech-ai.vercel.app/api/health
GET https://vilatech-ai.vercel.app/api/ai/models
```

- `chat.provider`: `"xavani"` = Shivani gateway linked; `"openrouter"` = interim MVP.
- `chat.primaryLabel`: should be **Omera (Shivani)**.

---

## 3. Final steps — production (operators)

### 3.1 Already on Vercel (do not remove)

| Variable | MVP value |
|----------|-----------|
| `APP_ORIGIN` | `https://vilatech-ai.vercel.app` |
| `OMERA_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_CLERK_*` / `CLERK_SECRET_KEY` | Clerk dashboard |
| `OPENROUTER_API_KEY` | OpenRouter (free tier OK) |
| `OPENROUTER_MODEL` | Fast free demo model, e.g. `google/gemini-2.5-flash-lite` |
| `OPENROUTER_MAX_TOKENS` | Optional `1200`–`1600` for shorter demo answers |

### 3.2 Shivani team — link real Xavani (preferred before scale)

Set on Vercel **Production** (server-only):

| Variable | Notes |
|----------|--------|
| `XAVANI_BASE_URL` | HTTPS origin, **no** `/v1` suffix, pathname `/` only |
| `XAVANI_API_KEY` | Same as Xavani `API_SERVER_KEY` (service secret, **not** OpenRouter key) |
| `XAVANI_MODEL` | `omera` (service alias; underlying model configured inside Xavani) |

Redeploy. Health should show `chat.provider: "xavani"`.

**Local reference:** `docs/setting-up-omera.md`, `scripts/setup-xavani-windows.ps1`, `scripts/link-omera-to-local-xavani.ps1`.  
**Xavani repo:** `enternovate/xavani-agent`, branch `feat/omera-api-mode` — `omera_mode: true`, provider keys in **Xavani’s** `.env` only.

### 3.3 Supabase (forms + cloud chat history)

Required for **cloud** form sessions and optional chat persistence:

1. Run migrations in order (see `docs/vercel-production-setup.md`), including `20261017000000_clerk_identity.sql`.
2. Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on Vercel.
3. Confirm private bucket `omera-forms` exists (migration).

Without Supabase, users can still **chat** (local history); **form upload/export** needs DB + storage.

### 3.4 Voice (optional for MVP)

| Variable | Purpose |
|----------|---------|
| `LELAPA_API_KEY` | Mic / transcription on form (and future chat voice) |

No Lelapa key → typing still works; mic routes may fail. This is separate from OpenRouter credits.

---

## 4. Developer checklist — integrate Shivani / Xavani properly

- [ ] Deploy Xavani with **Omera contract** (`GET /v1/capabilities`: `service.name=omera`, `tools_enabled=false`, etc.). Omera validates this on every chat (cached 5 minutes).
- [ ] Configure **underlying LLM** inside Xavani (e.g. OpenRouter model + key on Xavani host only).
- [ ] Provide Ayanda **production** `XAVANI_BASE_URL` + `XAVANI_API_KEY` for Vercel.
- [ ] Smoke test: signed-in user → `/chat` → **Omera (Shivani)** → 3 founder questions; confirm first tokens &lt; 30s on chosen model.
- [ ] Form path: upload a **fillable** PDF → analyze succeeds → complete required fields → `GET /api/forms/sessions/{id}/export` returns PDF.
- [ ] Document any model/prompt changes under `src/lib/ai/omera-system-prompt.ts` (persona) in PR handover.
- [ ] Do **not** put provider API keys in `XAVANI_API_KEY` on Omera — that slot is only the **service key**.

**Code touchpoints**

| Area | Path |
|------|------|
| Chat API | `src/app/api/chat/route.ts` |
| Model routing | `src/lib/ai/model-catalog.ts`, `src/lib/ai/chat-runtime.ts` |
| Xavani client | `src/lib/ai/xavani-client.ts` |
| OpenRouter fallback | `src/lib/ai/openrouter-client.ts` |
| Form AI (labels) | `src/lib/forms/extract-fields.ts` → `completeConfiguredJson` |
| PDF fill | `src/lib/forms/pdf-fields.ts`, `src/app/api/forms/sessions/[id]/export/route.ts` |

---

## 5. PDF form fill — what actually stops it (not “PDF credits”)

Filling the PDF **does not call OpenRouter per download**. Export uses **pdf-lib** on Vercel with a bundled font (`assets/fonts/NotoSans-Regular.ttf`).  

What **does** cost / block:

| Blocker | Symptom | Fix |
|---------|---------|-----|
| **No Supabase** | Upload/analyze/export 503 or no session | Add Supabase env + migrations |
| **No AI configured** | Analyze fails `FORM_TRANSLATION_FAILED` | `OPENROUTER_*` or `XAVANI_*` on Vercel |
| **OpenRouter rate limit / empty** | Chat works sometimes, analyze fails | Retry; faster model; small credit; or Xavani |
| **Not a fillable PDF** | `NO_FILLABLE_FIELDS` | User must upload **AcroForm** PDF (fields in Adobe “Prepare form”), not a flat scan |
| **XFA / signatures** | `UNSUPPORTED_XFA`, `SIGNATURE_REQUIRES_REVIEW` | Different PDF or manual review flow (engineering) |
| **Incomplete answers** | `INCOMPLETE_FORM` / 422 on export | Answer all **required** fields in UI |
| **Flat / scanned PDF** | No fields detected | Register template in `src/lib/forms/templates.ts` + layout (Shivani/eng) |
| **File too large** | `INVALID_PDF_SIZE` (&gt; 4MB) | Smaller PDF |

So Ayanda’s guess is **half right**: **AI credits/limits** affect **reading the form and translating questions**, not the PDF stamp step. **Wrong PDF type** is the most common demo failure.

**MVP demo tip:** Use a known **fillable** SA form PDF (checkboxes + text fields), complete every required field, then **Download completed PDF**.

---

## 6. Low-cost MVP stack (summary)

| Service | MVP cost | Required for |
|---------|----------|--------------|
| Vercel | Hobby / existing | Hosting |
| Clerk | Free tier | Auth |
| Supabase | Free tier | Forms + optional cloud chat |
| OpenRouter | $0–$10 | Chat + form label AI until Xavani hosts model |
| Xavani host | Shivani infra | “Own model” path, hides provider keys |
| Lelapa | If testing mic | Voice only |

---

## 7. Definition of done — Shivani sign-off (MVP)

- [ ] `chat.provider` is `xavani` **or** OpenRouter is stable for 10 consecutive demo prompts.
- [ ] Three scripted founder questions work in &lt; 45s to first tokens (demo model).
- [ ] One **fillable** PDF completes end-to-end: upload → voice or type → **completed PDF** download.
- [ ] `/api/health` `ok` or `degraded` with documented reason (not `unavailable`).
- [ ] Short handover note: env vars set, models used, known PDF limitations.

---

## 8. Link from product owner doc

The narrative spec for Shivani remains [`XAVANI-INSTRUCTIONS.md`](../XAVANI-INSTRUCTIONS.md) (vision + P0s). **This file** is the up-to-date **MVP production + integration** supplement (Clerk, OpenRouter, Xavani, Supabase, PDF truth).

*Update when Xavani production URL is fixed or form scope changes.*
