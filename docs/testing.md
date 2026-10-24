# Testing

## Suites

| Suite | Command | Count or state |
|---|---|---|
| Unit, routes, components | `npm run test` | 48 files, 662 passed, 1 skipped |
| Typecheck | `npm run typecheck` | 0 errors |
| Lint | `npm run lint` | clean |
| Build | `npm run build` | succeeds |
| Integration | `npm run test:integration` | BLOCKED: `ISOLATED_DATABASE_REQUIRED` |
| End to end | `npm run test:e2e` | BLOCKED: Playwright binaries |

Run one file:

```bash
npx vitest run tests/unit/xavani-client.test.ts
```

## Rules

1. Write the failing test first. Paste the failing output in the commit note.
2. A missing external input produces `BLOCKED`, never a skip.
3. A syntax error is not behavioral red evidence.
4. Every security control has a test. The table below is the list.

## Security guard tests

| Control | Test |
|---|---|
| Security headers | `tests/unit/security-headers.test.ts` |
| Origin on every mutating route | `tests/unit/route-guards.test.ts` |
| Rate limiter math | `tests/unit/rate-limit.test.ts` |
| Form analysis 429 | `tests/routes/forms-analyze-limit.test.ts` |
| Constant-time store secret | `tests/unit/store-gateway.test.ts` |
| Form text treated as data | `tests/unit/extract-fields-prompt.test.ts` |

## What tests do not cover

- Live provider inference. `/api/health` reports `unverified` until a real call.
- Real PDF forms. Three owner PDFs are still needed.
- Voice quality. Recordings and reviewers are still needed.
- Browser E2E. Playwright binaries are not installed.
