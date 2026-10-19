# OMERA (VILATECH AI) — build handover

**Omera** is VILATECH's business expert in a pocket: a South African
business adviser in chat plus form filling that ends in a completed
document, not a text dump.

- **Product owner:** Ayanda / VILATECH
- **Organization:** [Vilakazi-Technologies/OMERA](https://github.com/Vilakazi-Technologies/OMERA)
- **Requirements:** [`XAVANI-INSTRUCTIONS.md`](./XAVANI-INSTRUCTIONS.md)
- **Phase 3 (latest push + Andy / Xavani URL):** [`docs/PHASE-THREE-instructions.md`](./docs/PHASE-THREE-instructions.md)
- **Owner agenda / approved scope:** [`docs/AGENDA.md`](./docs/AGENDA.md) (PR [#1](https://github.com/Vilakazi-Technologies/OMERA/pull/1) merged)
- **Production:** [vilatech-ai.vercel.app](https://vilatech-ai.vercel.app) (redeploy from `main` when ready)

## Status

The approved local code scope is **complete and verified**. 77 local
commits sit on this branch. Every local gate passes with real test runs.
Seven acceptance gates stay **BLOCKED** because they need owner-supplied
inputs (model host and key, three real forms, consented recordings,
reviewers, publication approval). No gate is marked passed on a skip.

## Architecture

```
Browser -> OMERA Next.js server -> restricted Xavani service -> configured model
```

- OMERA keeps the product surface, PDF processing, the Lelapa speech
  adapter, and Supabase persistence.
- Xavani runs the chat model: stateless, tool-free, no memory, no
  transcript writes, one service key, loopback bind only.
- The browser never receives chat-model or speech credentials. No route
  calls a chat-model provider directly.
- The Xavani-side guards (branch `feat/omera-api-mode` in
  `enternovate/xavani-agent`) disable persistence after construction,
  guard the JSON/DB writers, the drain, the timeline, and debug dumps,
  and enforce authentication, route limits, request bounds, fresh request
  sessions, hidden provider errors, complete results, and the advertised
  capability contract.

## Definition of done — XAVANI-INSTRUCTIONS.md §5

| Requirement | State | Evidence |
|-------------|-------|----------|
| Business expert persona and behavior | CODE COMPLETE | `src/lib/ai/omera-system-prompt.ts`, chat schema, routes; live 12-scenario run (E1) blocked on model key |
| $0 → $100k staged plans without fluff | CODE COMPLETE | Prompt asks for currency and horizon; no guaranteed outcomes (E1 case 8). Currency/horizon answer pending owner |
| 11 spoken languages — chat | CODE COMPLETE | All 11 IDs accepted; reply-language contract; explicit selection overrides auto detection. Measured quality (E2) blocked on recordings and reviewers |
| 11 spoken languages — voice | HONEST PARTIAL | Documented routes: `eng`, `zul` supported; `afr`, `sot` beta; 7 unavailable with truthful UI status. No silent English fallback. Full coverage needs a verified fallback and owner approval |
| Form fill with real filled output | CODE COMPLETE | AcroForm inspection and fill, private storage, revision recovery, review screen, `Download completed PDF`. Real-form acceptance (E3) blocked on 3 owner PDFs |
| Production hardening | CODE COMPLETE | Demo mode gated; honest `/api/health`; server-only service client; no `NEXT_PUBLIC_` secret; smoke script. Vercel keys and deploy (E5) blocked on publication approval |
| Handover note | THIS FILE | `docs/operations.md`, `docs/voice-support.md`, `docs/form-support.md`, `docs/security-review.md` |

## What was built (77 commits, in order)

### Platform and modules (P01–P05, C01–C10)

- Node 24 project runtime, vitest/integration/playwright harness, licensed PDF font.
- Demo-mode gate, business-adviser prompt, chat request schema, fragmented SSE parser, Xavani client (`getXavaniConfig`, `createXavaniChatStream`, `completeXavaniJson`), Lelapa sync speech adapter, bounded WAV codec, answer preservation, real PDF text extraction, real AcroForm field inspection and fill with glyph checks.

### Xavani runtime guards (X01-A, X01-B1, X01-B2, X02 — 19 commits)

- Restricted construction with primary-only provider resolution.
- Persistence disabled after construction; JSON writer, DB writer, drain, timeline, and debug dumps guarded; ordinary persistence proved by controls.
- HTTP guards: service key, route auth, stateful API denial, state-header rejection, envelope validation, 256 kB bound, fresh request sessions, hidden provider errors, complete-result enforcement, capability contract, boundary proofs.
- SSE completion reports `stop` only on a complete result (`length` on partial, `error` on failure).

### OMERA integration (I1–I5 — 51 commits)

- **I1 identity:** Supabase SSR cookie sessions, verified OTP routes, session hydration, origin checks, bounded body reads, atomic quotas, neutral API errors. The unsigned `omera_uid` cookie is fail-closed and never identity proof.
- **I2 chat:** the chat route verifies identity, origin, size, schema, ownership, and quota, then streams through Xavani. Partial streams are not saved as completed answers. `openai` is fully removed.
- **I3 speech:** native transcription in the selected language with no translation, capability model, resampler, bounded recorder with track cleanup.
- **I4 forms:** strict contracts, private storage with trusted paths, Xavani field interpretation with exact coverage, owned session routes with revision checks, real PDF export, one-question flow, review screen, refresh recovery.
- **I5 claims:** honest health status, aligned landing claims, smoke script, operations docs.

### Verification close-out (this session — 3 commits)

- Five BLOCKED-loud database integration suites (identity isolation, quotas, storage privacy, recovery, deletion).
- Lint ignore for generated coverage output.
- Dead code removal (the unused Lelapa adapter).

## Verification evidence

Run on 2026-10-15 with the project-local Node `v24.21.0`:

```bash
export PATH="$PWD/.local/node-v24.21.0-darwin-arm64/bin:$PATH"
npm run test -- --maxWorkers=1   # 41 files, 622 tests passed
npm run typecheck               # clean
npm run lint                    # clean
npm run test:coverage           # 98.87% stmts / 97.91% branch / 100% funcs / 99.64% lines
npm run build                   # 15 API routes, 5 pages
npm run test:integration        # BLOCKED: ISOLATED_DATABASE_REQUIRED (6 files, no silent skips)
```

Xavani (`enternovate/xavani-agent`, branch `feat/omera-api-mode`,
isolated Python 3.11 venv):

```bash
.local/omera-test-venv/bin/python -m pytest \
  tests/gateway/test_omera_http.py \
  tests/gateway/test_omera_api_stream.py \
  tests/gateway/test_api_server_omera_policy.py \
  tests/gateway/test_api_server.py -o addopts= -q
# 228 passed
```

## Decisions that need owner sign-off

1. **Xavani runs the model**, not OpenAI (owner decision recorded in `DECISIONS.md`). This replaces the direct-OpenAI deployment detail in the handover instructions.
2. **Voice ships as 4 documented routes**, not 11. The instructions ask to close the gap; the provider documents 4 routes. Full completion needs a verified fallback or an approved dated rollout exception.
3. **Chat quota limit is 60 requests per user** (`CHAT_QUOTA_LIMIT`) — no limit was specified anywhere.
4. **Health status vocabulary** is `ok` / `degraded` / `unavailable`; chat compatibility and inference report `unverified` until a live check exists.
5. **No dependency bumps.** `npm audit` reports 7 high and 1 critical findings on the existing Next.js line. `docs/security-review.md` records the position. A major bump is a release decision.
6. **Legacy demo rows** stay outside identity mappings; new users are created with `email: null`.

## BLOCKED gates and the input each waits for

| Gate | Missing input |
|------|---------------|
| X03 live Xavani verification | Dedicated host, model, provider key, budget |
| E1 12 business scenarios | Live model + rubric approval |
| E2 33 chat cases + 110 voice clips | Consented recordings + 11 reviewers |
| E3 3 real forms | Owner-supplied PDFs with permitted use |
| E5 deployment and handover | Publication approval |
| ENV-1 Playwright binaries | Install approval (specs written, not run) |
| ENV-2 isolated Supabase | Account authorization (migrations unapplied) |

Missing inputs produce BLOCKED. They never produce a silent PASS.

## Run locally

```bash
export PATH="$PWD/.local/node-v24.21.0-darwin-arm64/bin:$PATH"  # project Node 24
npm ci
cp .env.example .env.local
npm run dev
```

Environment (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `XAVANI_BASE_URL` | Restricted Xavani service origin (no `/v1` suffix) |
| `XAVANI_API_KEY` | Dedicated service secret (server only) |
| `XAVANI_MODEL` | Service alias, for example `omera` |
| `LELAPA_API_KEY` | Voice transcription (server only) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Persistence (server only) |
| `APP_ORIGIN` | Trusted origin for state-changing requests |
| `OMERA_DEMO_MODE` | `false` in production |

## Tests

- `tests/unit/` — module and contract tests.
- `tests/routes/` and `tests/components/` — route and component behavior.
- `tests/integration/` — database suites. They fail with `ISOLATED_DATABASE_REQUIRED` until an approved isolated target exists.
- `tests/e2e/` — browser specs. They need the Playwright binaries.
- `npm run test`, `npm run test:integration`, `npm run test:e2e`, `npm run test:coverage`.

## Repository map

| Area | Path |
|------|------|
| Chat UI / API | `src/app/(platform)/chat/`, `src/app/api/chat/` |
| Form UI / API | `src/app/(platform)/form/`, `src/app/api/forms/` |
| Identity | `src/lib/auth/`, `src/lib/supabase/`, `src/app/api/auth/` |
| AI runtime | `src/lib/ai/` |
| Speech | `src/lib/speech/`, `src/app/api/transcribe/` |
| Forms core | `src/lib/forms/` |
| Migrations | `supabase/migrations/` |
| Docs | `docs/` |

## What Ayanda should test first

1. Chat: ask a founder question in isiZulu; replies stay in isiZulu.
2. Voice: speak an answer for `eng` or `zul`; the transcript stays in the spoken language.
3. Forms: upload a real AcroForm PDF, answer by keyboard and by mic, refresh mid-flow, review, download the completed PDF, reopen it.
4. Health: open `/api/health` and check the honest status fields.

Built by **VILATECH** — South Africa.
