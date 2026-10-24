# ADR-0004 — Vercel hosts the origin, Render runs the process

- Status: accepted
- Date: 2026-10-24

## Context

Vercel Functions are request-scoped and cap at 60 seconds. Xavani must stay
warm for chat. A serverless function cannot guarantee that.

## Decision

- Render runs the `xavani_omera` service on the free plan, kept awake by a
  5-minute health ping.
- Vercel hosts a small project with one external rewrite to the Render origin.
  This gives Xavani a `*.vercel.app` public origin.
- Omera calls the Vercel origin.

If the Vercel proxy buffers the SSE stream, Omera calls the Render origin
directly and the Vercel project becomes a status page.

## Consequences

- One always-on process, one public origin.
- The proxy adds a network hop.
- Streaming through the proxy is a release gate, not an assumption.
- Deploying the ASGI app as a Vercel Function remains possible but is not the
  chosen path.
