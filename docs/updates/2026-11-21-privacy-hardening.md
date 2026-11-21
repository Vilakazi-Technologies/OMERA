# OMERA privacy hardening and readiness update

Date: 2026-11-21
Prepared by: Enternovate (Andile Mushwana)
Branch: chore/omera-privacy
Base: feat/omera-integration

This update documents the privacy audit, the repairs, and the verification.
It also lists the steps that need the project owner before production go-live.

## 1. Summary

A privacy audit found that OMERA error paths could expose provider detail.
The repair removes that exposure and adds secret-leak prevention.
All changes are tested and the production build passes.
No secret value appears in this document or in the commits.

## 2. What the audit found

- Five error log sites forwarded raw error messages or provider detail.
- The vision error response returned up to 200 characters of provider detail.
- OMERA had no GitHub secret scanning and no push protection.
- OMERA had no secret-scan CI workflow and no pre-commit hook.
- Ignore rules did not cover private notes, credentials, or logs.
- One test asserted the leaky behavior as correct.
- One test had a wrong field-order expectation and failed on the base.
- Next.js 16.4.3 carried moderate security advisories.

The OMERA Git history scans clean: 0 detector findings across 169 commits.

## 3. Changes in this branch

### cd92b6b — keep provider detail out of error logs and responses

- src/app/api/forms/analyze/route.ts: 3 log sites now record only the error
  class or a safe code.
- src/app/api/store/complete-vision-json/route.ts: the log records only the
  error class; the response returns a generic error and keeps HTTP 502.
- src/lib/forms/pdf-text.ts: the log records only the error class.
- The analyze response already uses apiErrorResponse and is unchanged.
- HTTP status codes and successful document behavior are unchanged.
- New regression tests use synthetic markers and prove the detail no longer
  reaches a log or the response.

### 903a1fd — add secret scanning and private file ignores

- .github/workflows/secret-scan.yml: a blocking Gitleaks workflow.
- .pre-commit-config.yaml: private-key and secret hooks before each commit.
- .gitignore: ignores private notes, credentials, and logs. .env.example stays
  committable.

### 0814458 — correct the field-order expectation

- tests/unit/extract-fields.test.ts: the question-flow sort is correct; the test
  now asserts canonical identity order-insensitively, like the sibling test.

### 984daa9 — bump Next.js to 16.4.6

- package.json and package-lock.json: patch-level upgrade clears the moderate
  Next.js advisories.

## 4. Verification

- Full test suite: 770 passed, 0 failed, 1 skipped.
- Typecheck: 0 errors. Lint on changed files: 0 errors, 0 warnings.
- Production build: succeeds on Next.js 16.4.6; all routes compile.
- npm audit (production deps): 0 vulnerabilities.
- Gitleaks on the new commits: no leaks.
- Each privacy test fails on the leaky source and passes after the repair.
- The pre-commit hook ran on real commits and passed all checks.

## 5. GitHub protection status

- OMERA secret scanning: enabled.
- OMERA secret scanning push protection: enabled.
- These block known secret formats at push time.

## 6. Steps that need the project owner

1. Review and merge this branch into feat/omera-integration.
2. Verify the production Supabase service-key source. Confirm the key belongs
   to project lpnlyethmoilqwoekvmc with the service_role, and check the bucket
   policies. Keep the value hidden.
3. Provide a model provider key for the Xavani Render backend and run the
   authenticated model-inference gate. The backend currently reports
   inference false, so the demo still runs on OpenRouter.
4. Replace any password that was posted in chat during the session.
5. Approve deployment after the model gate passes.

## 7. Related Xavani work (separate repository)

The Xavani backend (enternovate/xavani-agent, branch feat/omera-api-mode) received
matching dependency-pin and secret-scan hardening. Its history triage found no
active secret that needs rotation. That work is tracked in its own repository.

## 8. Limits

- The audit does not validate credentials against their providers.
- The audit does not inspect cloud logs or the deployed bundle.
- No scan guarantees that future code never leaks data. The local hook, the
  blocking CI, and GitHub push protection form three layers against it.
