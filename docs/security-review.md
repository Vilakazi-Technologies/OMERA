# Dependency audit position (2026-10-15)

`npm audit` reports **8 vulnerabilities (7 high, 1 critical)**. No fix is
applied in this change: every available fix requires `npm audit fix --force`
and moves version lines outside what the lockfile pins (Next.js 16.2.12 to
16.4.1, plus an eslint-config-next line change). Even a minor Next.js bump
can change App Router runtime behavior that the I1-I5 integration packs
depend on (route handlers, cookie handling, streaming, image optimization),
so the update needs an isolated branch with full gate verification and
explicit owner sign-off — not a silent in-place fix.

Owner approval is required before any update. Do not run
`npm audit fix --force` without it.

## Findings

| # | Package (installed) | Severity | Advisory | Fixed in | Breaking-change risk |
|---|---------------------|----------|----------|----------|----------------------|
| 1 | next@16.2.12 | critical | GHSA-p293-qw3h-jr36 — Unauthenticated RCE on Windows-hosted servers | next@16.4.1 | Major bump outside the stated range; App Router behavior risk |
| 2 | next@16.2.12 | high (via next) | GHSA-2xp9-vwfh-vw4 — RCE in Image Optimization API (AVIF) | next@16.4.1 | Same as above |
| 3 | next@16.2.12 | high (via next) | GHSA-vcvr-r3jv-pc5j — RCE in next/og ImageResponse | next@16.4.1 | Same as above |
| 4 | next@16.2.12 | high (via next) | GHSA-4jqv-mc3x-m676 — cache poisoning of SSG/ISR (self-hosted) | next@16.4.1 | Same as above |
| 5 | next@16.2.12 | high (via next) | GHSA-39w2-rjm5-chcv — information disclosure in dev-server MCP endpoint | next@16.4.1 | Same as above |
| 6 | next@16.2.12 | high (via next) | GHSA-f87g-xv8r-7p7x — information disclosure in metadata image routes (dynamicParams bypass) | next@16.4.1 | Same as above |
| 7 | next@16.2.12 | high (via next) | GHSA-rmcj8-r9mp-w47p / GHSA-cjq9-62q9-8jv4 — SSG/ISR cache poisoning (DoS) / SSRF in Image Optimization | next@16.4.1 | Same as above |
| 8a | postcss (nested under next) / sharp (nested under next) | high | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, GHSA-f88m-g3jw-g9cj, GHSA-g89c-p67h-r497, GHSA-2jg2-4ch7-h545, GHSA-wq5f-xc86-pv6w (postcss XSS/source-map reads; sharp libvips/libheif/librsvg) | next@16.4.1 | Same as above (nested deps move with Next.js) |
| 8b | braces@3.0.3 (via eslint-config-next chain) | high | GHSA-vfj7-8cjw-p6xm — stack-exhaustion DoS via nested patterns | eslint-config-next line change | Lint behavior risk |

Note: the top-level `postcss@8.5.30` (via @tailwindcss/postcss) is past the
vulnerable range; the flagged postcss/sharp copies are nested under `next`.

## Proposed update order (after owner approval)

1. Stage a Next.js 16.2.x -> 16.4.x bump on an isolated branch; run the full
   suite (`lint`, `typecheck`, `test`, `test:coverage`, `build`) plus the
   BLOCKED integration/browser gates once their environments exist. Treat
   the minor line the same as a major for verification purposes: the
   integration packs depend on exact route-handler and streaming behavior.
2. Re-run `npm audit`; confirm zero high/critical findings.
3. Pick up the eslint-config-next line change in the same branch and re-run
   `npm run lint` (lint behavior may change).
4. Obtain explicit owner sign-off before merging: the bump ships new runtime
   behavior to production.

## Current posture

- Production builds pin exact versions via `package-lock.json`.
- The flagged Next.js RCE/SSRF paths (Windows hosting, AVIF image
  optimization, next/og, dev-server MCP endpoint) are not part of the
  deployed OMERA surface, which reduces but does not remove exposure.
- This document is the audit position. The update waits for owner approval.
