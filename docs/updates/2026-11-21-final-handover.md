# Omera / Xavani — Final handover and verification record

Date: 2026-11-21
Prepared by: Enternovate (Andile Mushwana)
For: Ayanda Vilakazi (Vilakazi-Technologies/OMERA)
Production: https://vilatech-ai.vercel.app
Supabase project: lpnlyethmoilqwoekvmc (Omera, main, PRODUCTION)

## 1. What was delivered

### Privacy hardening (merged, live)
- Five error log sites and the vision error response no longer expose provider
  detail or raw error messages. They log only a safe error class/code.
- Regression tests prove a synthetic secret marker never reaches a log or the
  response. Tests fail on the leaky code and pass after the fix.
- The analyze response already used a safe error mapper and is unchanged.

### Honest document understanding (merged, live)
- A maths assignment (or any assignment/exam) is now named honestly in the
  briefing, e.g. "This is a maths assignment on integration. It is not a fillable
  form." It is no longer rejected with "upload a form".
- The no-fill-in message is honest and keeps the briefing useful instead of
  pushing the user to upload a different file.
- Works for the AI brief and the offline heuristic fallback.

### Upload limit (merged, live)
- In-app upload limit raised from 10 MB to 20 MB.
- Honest platform note kept: Vercel serverless request bodies are capped near
  4.5 MB, so files above that may still be blocked by the host. The error copy
  states this plainly.
- A migration raises the Supabase bucket to 20 MB (see section 6 — needs one
  manual Run click).

### Security posture (verified)
- OMERA: secret scanning, push protection, Dependabot security updates, and
  vulnerability alerts all enabled. Open Dependabot alerts: 0. The one alert
  (minimatch DoS, GHSA-g3hv-75wg-m249) was fixed by overriding the
  typescript-eslint copy to patched 11.x; the alert state is now "fixed".
- Xavani: secret scanning + push protection enabled; Dependabot security updates
  + alerts enabled.
- Blocking Gitleaks CI workflow + active pre-commit hooks on both repos. The hook
  ran on real commits and passed.
- Leak scan: git history (74 commits) clean; src + supabase clean. The only
  gitleaks flags were false positives in gitignored .next build artifacts.

## 2. Checks (all passing)

- OMERA full test suite: 773 passed, 0 failed, 1 skipped.
- Typecheck: 0 errors. Full-project lint: 0 errors (7 pre-existing warnings).
- Production build: exit 0.
- Live chat: Xavani returns a full, correct answer (verified in the browser).
- PDF reading: the maths assignment PDF is read successfully.
- Deploy confirmed live: the form page now shows "Max 20 MB".

## 3. Commits and branches

OMERA (Vilakazi-Technologies/OMERA):
- chore/omera-privacy: privacy fixes, honest understanding, 20 MB limit, tests,
  migration. Merged via PR #2 and PR #3.
- feat/omera-integration: integration branch, up to date.
- main: fast-forwarded to 203e6c5 (all of the above). Production deploys from main.

Xavani (enternovate/xavani-agent):
- feat/omera-api-mode: dependency-pin fix + secret-scan hardening. Pushed.

## 4. What Ayanda needs to do

1. Run the migration (one click). It is in the clipboard and the SQL editor is
   open. Press Cmd+V, then click Run (or Cmd+Enter). It adds brief_json if missing
   and raises the omera-forms bucket to 20 MB. Idempotent and safe.
2. Upload the maths assignment again to confirm it briefs honestly end-to-end.
3. Replace the password that was posted in chat earlier.
4. Provide a model provider key for the Xavani Render backend and run the
   authenticated model-inference gate before switching the caller off OpenRouter.

## 5. Known limits / remaining work (honest)

- The live end-to-end upload re-test could not be automated: the browser-control
  driver session ended and the native file picker / Monaco editor are not
  driveable. A manual upload (step 2) confirms it.
- Xavani main branch carries 191 pre-existing Dependabot alerts (8 critical)
  across the full agent dependency tree. Dependabot is enabled to auto-propose
  fixes, but clearing all 191 is a separate, larger remediation effort. It is not
  part of the Omera runtime (whose deploy pins have 0 known vulnerabilities).
- The Render model-inference gate needs a model provider key; until it passes,
  the demo runs on OpenRouter.
- No scan guarantees future code never leaks. The local hook, blocking CI, and
  GitHub push protection are the three standing layers.

## 6. Migration (idempotent)

alter table public.omera_form_sessions add column if not exists brief_json jsonb;
update storage.buckets set file_size_limit = 20000000 where id = 'omera-forms';

Also committed as supabase/migrations/20261121120000_form_brief_and_20mb.sql.
