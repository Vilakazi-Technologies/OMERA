# Omera operations

How to run, retain, delete, and roll back Omera. This document makes no
legal certification claim (no POPIA, GDPR, ISO, or SOC 2 attestation).
Regulatory sign-off is an owner decision recorded in DECISIONS.md as an
open acceptance input.

## Runtime topology

- Next.js application (`npm run build`, `npm start`). All state-changing
  API routes require an exact `APP_ORIGIN` match plus a verified Clerk
  identity.
- Inference is stateless and tool-free through the Xavani runtime
  (`XAVANI_BASE_URL`, `XAVANI_API_KEY`, `XAVANI_MODEL`). A present key
  never proves successful inference; see `GET /api/health`.
- Voice transcription goes to the Lelapa voice service
  (`LELAPA_API_KEY`, server only).
- Persistence lives in Supabase (`SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` server only). Auth lives in Clerk
  (`CLERK_SECRET_KEY` server only). The browser never receives a Supabase key.
- `OMERA_DEMO_MODE=true` is for explicit local demos only and never for
  shared environments.

## Data processors

| Processor | Purpose | Data sent |
| --- | --- | --- |
| Xavani runtime | Chat replies, form label/prompt translation | Message text, field labels |
| Lelapa voice service | Speech transcription | Audio bytes, language ID |
| Supabase | Auth, conversations, form sessions, stored objects | Account, session, and document data |

Customer transcripts are kept outside runtime logs. Secret values
(`*_API_KEY`, `*_SERVICE_ROLE_KEY`) never appear in user-facing text,
error bodies, or the smoke report.

## Retention

- Retention windows are an operator decision and must be recorded here
  before customer use. No retention schedule is claimed until then.
- Conversations, messages, form sessions, and stored objects persist
  until deleted through the product or by the operator.
- There is no automatic purge job in the codebase; expiry depends on
  operator action.

## Deletion behavior

- Form session deletion removes the owned session row plus its private
  objects, retrying transient object failures. A failed session write
  removes the orphaned stored object.
- Export verifies the SHA-256 of the stored bytes before filling; a
  failed export keeps the session in `review` and deletes nothing.
- Deletion requests beyond the product surface (account removal,
  processor-side copies) are handled manually by the operator and
  tracked per request.

## Pre-release verification

1. `npm run typecheck`
2. `npm run test` (full unit and route suite, currently green)
3. `node scripts/smoke.mjs --target <staging-url>`; paid round trips
   only with an explicit `--paid` operator run
4. `GET <staging-url>/api/health` reports `ok`; anything else blocks
   the release

## Failed-release runbook

1. Detect: the smoke script reports FAIL, or `/api/health` stops
   reporting `ok`. Note the failing check and its HTTP status only —
   never paste provider bodies into incident notes.
2. Freeze: stop the rollout; take no further deploy action until the
   blast radius is known (health vs chat vs transcription vs forms).
3. Assess: compare against the last green build. `git log --oneline`
   identifies the suspect range; the suite rerun
   (`npm run test -- <area>`) confirms or clears each area.
4. Roll back: redeploy the last green build, then rerun
   `node scripts/smoke.mjs --target <url>` until `smoke: no failures`.
5. Record: append the incident (date, failing check, rolled-back
   commit, restoring commit) below. Keep all commits local until the
   owner approves publication or deployment.

## Incident log

No incidents recorded yet.
