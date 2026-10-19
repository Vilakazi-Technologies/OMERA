# XAVANI instructions — Omera integration handover

**For:** Shivani (XAVANI) — AI integration lead  
**From:** Ayanda / VILATECH (Vilakazi Technologies)  
**Repo:** [github.com/Vilakazi-Technologies/OMERA](https://github.com/Vilakazi-Technologies/OMERA)  
**Production (current):** [vilatech-ai.vercel.app](https://vilatech-ai.vercel.app)

> **Phase 3 handover (Andy — domain + Xavani URL):** **[`docs/PHASE-THREE-instructions.md`](docs/PHASE-THREE-instructions.md)** — what was pushed, health/models APIs, Gemini 2.0 interim, and exactly what to host for Shivani’s AI.  
> **MVP / production integration (developers):** **[`docs/shivani-mvp-production.md`](docs/shivani-mvp-production.md)** — Vercel env, PDF troubleshooting.  
> **Demo script:** [`docs/mvp-demo.md`](docs/mvp-demo.md).

Read this file first for **product vision and P0 scope**. It is not a substitute for the current env stack (Clerk + OpenRouter/Xavani + Supabase)—see the doc above.

---

## 1. What Omera is (product vision)

Omera is **your personal business expert in your pocket**: someone you can open quickly on your phone or laptop and trust to **guide you in building and growing a real business**—from idea and zero revenue toward serious scale (product owner frames this as **$0 → $100,000** in revenue with practical, step-by-step help).

Omera must feel like:

- A **business coach + operator**: strategy, sales, marketing, operations, compliance basics, cash flow, hiring, customer discovery—not vague motivation.
- **Action-oriented**: concrete next steps, checklists, frameworks, and examples suited to **South African** context (regulation, languages, local market realities).
- **Always available**: fast chat, same interaction model as leading global assistants, but **purpose-built for business success**.

Omera is **not** only a chatbot. It is VILATECH’s flagship AI for **business development and growth**, with a second major capability: **helping people complete forms** (applications, onboarding, admin) with less typing—especially by **voice**.

**Tone:** Professional and trustworthy (think formal, clear product communication), warm for SA users, premium VILATECH brand. See landing copy and `LandingStatement` for the public voice.

---

## 2. What Ayanda needs you to deliver (priority order)

### P0 — Business expert AI (core identity)

| Requirement | Detail |
|-------------|--------|
| **Persona** | Omera behaves as a **business expert**, not a generic assistant. Default conversations should support planning, validation, go-to-market, pricing, retention, and scaling. |
| **Outcome framing** | Help users move from **no business / early stage → sustainable revenue**, with a credible path toward **$100k** (confirm currency and timeline with Ayanda—see §7). |
| **Practical output** | Prefer structured answers: phases, weekly actions, risks, metrics, and “do this next” when appropriate. |
| **SA context** | POPIA awareness, multilingual SA, local examples (SARS basics, CIPC/registration pointers at a high level, township/suburban/enterprise contexts) without stereotypes. |
| **Implementation** | Start with `src/lib/ai/omera-system-prompt.ts` and chat route `src/app/api/chat/route.ts`. Extend with tools, RAG, or fine-tuning only if needed—document what you choose. |

**Success looks like:** A founder opens chat, asks in plain language how to start or grow a business, and gets **expert, actionable** guidance that feels like a hired business advisor—not demo filler.

### P0 — Eleven official languages (chat + voice)

| Requirement | Detail |
|-------------|--------|
| **Chat** | User can **write** in any of South Africa’s **11 official languages** and receive **replies in that same language** (unless they ask otherwise). |
| **Voice** | User can **speak** answers (form flow and eventually chat) and get accurate transcription; assistant text should match selected language. |
| **UI** | Language list lives in `src/lib/languages.ts`; selector in chat/form UI. |
| **Today** | Not all languages are `live` for speech—several are `beta` or `planned`. **Your job is to close the gap** using Lelapa (and fallbacks documented in code) until all eleven are credibly supported end-to-end. |
| **Keys** | `LELAPA_API_KEY` for transcription; OpenAI for chat—see `.env.example`. |

**Success looks like:** A user selects isiZulu (or any official language), speaks or types, and gets **consistent** isiZulu (or chosen language) from Omera—not English by default.

### P0 — Form fill that actually fills the form

| Requirement | Detail |
|-------------|--------|
| **User story** | Upload PDF (or supported doc) → Omera extracts fields → asks **one question at a time** (on screen, quiet for offices) → user types or **uses mic** → user reviews → **downloads a completed form** (filled PDF or equivalent). |
| **Today** | Q&A works; **filled PDF export** is implemented server-side (`src/app/api/forms/sessions/[id]/export/route.ts`, `src/lib/forms/pdf-fields.ts`) for **AcroForm** PDFs when Supabase + AI are configured. **Flat/scanned** PDFs still need templates (`src/lib/forms/templates.ts`). UI: **Download completed PDF** on `src/app/(platform)/form/page.tsx`. |
| **Your job** | Improve **field detection** on real SA forms, **templates** for common flat PDFs, voice in all languages, and reliability when OpenRouter/Xavani rate-limit. See **`docs/shivani-mvp-production.md` §5** for blockers. |

**Success looks like:** User uploads a real SA form PDF, completes by voice in their language, and leaves with a **file they can submit**—not only a `.txt` summary.

### P1 — Production hardening

- Remove or gate **demo mode** when keys are present; `/api/health` should reflect true state.
- Secure env vars on Vercel (never expose service role client-side).
- Tests or smoke scripts for chat stream, transcribe, and form analyze (your choice—document in PR).

### Out of scope for this repo (unless Ayanda says otherwise)

- **Lorraine Butte** — separate chat product under Vilakazi workspace; Ayanda may handle separately. Do not block Omera on it.

---

## 3. Codebase map (start here)

| Area | Path |
|------|------|
| Landing / brand | `src/components/landing/*` |
| Chat UI | `src/app/(platform)/chat/page.tsx` |
| Form UI | `src/app/(platform)/form/page.tsx` |
| System prompt | `src/lib/ai/omera-system-prompt.ts` |
| Chat runtime (Xavani / OpenRouter) | `src/lib/ai/chat-runtime.ts`, `src/app/api/chat/route.ts` |
| Model catalog | `src/lib/ai/model-catalog.ts` |
| Demo chat (no key) | `src/lib/ai/demo-stream.ts` |
| Form PDF export | `src/app/api/forms/sessions/[id]/export/route.ts` |
| Transcription | `src/app/api/transcribe/route.ts`, `src/lib/lelapa.ts` |
| Languages | `src/lib/languages.ts` |
| Form analysis | `src/app/api/forms/analyze/route.ts` |
| DB schema | `supabase/migrations/20261005100000_omera_platform.sql` |
| Client sync | `src/lib/omera-sync.ts`, `src/context/app-provider.tsx` |

**Run locally:** `npm install` → copy `.env.example` to `.env.local` → `npm run dev`.

---

## 4. Environment & deployment

**Authoritative MVP list:** [`docs/shivani-mvp-production.md`](docs/shivani-mvp-production.md) and [`docs/vercel-production-setup.md`](docs/vercel-production-setup.md).

| Variable | Purpose |
|----------|---------|
| `XAVANI_BASE_URL` / `XAVANI_API_KEY` / `XAVANI_MODEL` | Preferred chat + form AI (Shivani gateway); `omera` alias |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | Interim MVP when Xavani not hosted (low/zero cost free models) |
| `NEXT_PUBLIC_CLERK_*` / `CLERK_SECRET_KEY` | Auth (only provider) |
| `LELAPA_API_KEY` | Voice transcription (optional for MVP) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Forms storage + optional cloud chat |

Vercel project: **vilatech-ai**. Production: [vilatech-ai.vercel.app](https://vilatech-ai.vercel.app).

---

## 5. Definition of done (checklist for Shivani)

Use this when reporting back to Ayanda:

- [ ] **Business expert:** System prompt + model behavior validated with 10+ realistic founder scenarios (idea → first sale → growth).
- [ ] **$0 → $100k narrative:** Omera can outline staged plans (confirm currency with owner) without generic fluff.
- [ ] **11 languages — chat:** Reply in user’s language for all official languages in UI.
- [ ] **11 languages — voice:** Speech in + text out works for each language (or documented rollout with dates for `planned`).
- [ ] **Forms:** Filled **PDF** (or agreed format) export works on at least 3 real-world PDF forms.
- [ ] **Production:** Keys on Vercel; `/api/health` shows chat configured + database; `chat.provider` xavani or openrouter.
- [ ] **Handover:** Short note in PR or comment on what you changed and what Ayanda should test.

---

## 6. How to work with Ayanda

- **Git:** Push to `main` via PR if the org requires review; keep commits focused.
- **Questions:** Use §7 below—confirm anything ambiguous **before** large architectural bets.
- **Brand:** User-facing name is **Omera** (VILATECH). Do not surface vendor names (OpenAI, Lelapa, etc.) in the UI unless debugging/internal docs.

---

## 7. Open questions — confirm with Ayanda

Please get explicit answers from the product owner and record them in your PR or a short `DECISIONS.md` if useful:

1. **$100,000** — USD, ZAR, or user-selectable? Over what time horizon (12 months, 24 months)?
2. **Business expert depth** — Sole proprietors and SMMEs only, or also corporate intranet / enterprise teams?
3. **Regulated advice** — Any disclaimer needed for tax, legal, or financial guidance (refer to professionals)?
4. **Form fill** — Priority PDF types (HR, insurance, government) and must-have field types (signatures, checkboxes)?
5. **Supabase** — Stay on current project (`meeting-pro-web` / migration in repo) or new dedicated Omera project?
6. **Lorraine Butte** — Timeline and whether shared AI stack with Omera is desired later.

---

## 8. One-sentence summary for Shivani

**Make Omera a credible, multilingual, South African business expert in chat—and finish the form pipeline so users leave with a completed document, not a text dump.**

---

*Document version: handover for Vilakazi Technologies / OMERA repo. Update this file when product scope changes.*
