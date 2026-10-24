# ADR-0003 — Research mode is a first-class mode

- Status: accepted
- Date: 2026-10-24

## Context

The prototype must run with no paid keys. A free model endpoint exists but is
rate limited to about one reply per 30 seconds per IP. An empty error screen is
worse than a cited answer.

## Decision

Omera runs a live research pass on the server and picks one of three modes:

- `model`: an inference key exists. The model writes the reply.
- `keyless`: an explicit opt-in endpoint writes the reply.
- `research`: no model. The answer is assembled from fetched pages and cites
  them.

`/health` reports the mode. A keyless failure pauses that path for 120 seconds
and falls back to research.

## Consequences

- The product works with zero keys and zero cards.
- Research answers are extractive, not conversational.
- Translation needs a model. Language evidence is blocked without a key.
- The mode label is visible in the answer. No hidden degradation.
