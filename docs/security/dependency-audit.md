# Dependency audit (2026-10-24)

`npm audit` reports **3 findings: 1 critical and 2 high**. All three resolve
with `next@16.4.3`, a minor change inside the 16 line.

## Findings

| Package | Severity | Advisories | Fix |
|---|---|---|---|
| next | critical | GHSA-p293-qw3h-jr36 (RCE, Windows), GHSA-2xp9-vwfh-vxw4 (RCE, AVIF), GHSA-vcvr-r3jv-pc5j (RCE, next/og), GHSA-2464-fhr4-w9xw (RCE, SVG), GHSA-673q-mjm6-r5xr (RCE, use cache) | next@16.4.3 |
| next | high | GHSA-cjq9-62q9-8jv4 (SSRF, image optimization), GHSA-p3m5-59mp-jv5r (DoS, server actions) | next@16.4.3 |
| postcss (nested) | high | GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 (source map file read) | next@16.4.3 |
| sharp (nested) | high | GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w (libvips, libheif, librsvg) | next@16.4.3 |

## Exposure

Omera does not use `next/og`, AVIF optimization, `use cache`, or self-hosted
ISR. The advisory code is still present in the runtime. A critical advisory on a
server that holds the Supabase service role key is urgent even when the feature
is unused.

## Plan

1. Branch `security/next-16.4.3`.
2. `npm install next@16.4.3 eslint-config-next@16.4.3`.
3. Run lint, typecheck, the full suite, and the build.
4. Confirm `npm audit` reports no high or critical findings.
5. Owner approval, then merge.

## Verification

```bash
cd ~/OMERA
npm audit --omit=dev
npm run typecheck
npm run test -- --maxWorkers=1
npm run build
```

Expected: audit clean, typecheck clean, 671 tests pass, build succeeds.

## Current posture (2026-10-24, after the upgrade)

- `next@16.4.3` and `eslint-config-next@16.4.3` are merged.
- `npm audit` reports **0 vulnerabilities**.
- Gates: lint 0 errors (5 warnings), typecheck clean, 671 tests passed, build
  succeeds.
- The live header check needs a deployed build with production Clerk env. It is
  a deploy gate, not a code gate.

## History

The earlier position recorded 3 findings (1 critical, 2 high) on
`next@16.2.12`. The upgrade was staged on `security/next-16.4.3` and merged into
`feat/omera-integration` after the owner approved it. No force fix was used.
