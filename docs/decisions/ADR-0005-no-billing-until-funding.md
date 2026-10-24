# ADR-0005 — No billing code before funding

- Status: accepted
- Date: 2026-10-24

## Context

`docs/MONETIZATION.md` defines tiers and suggests Stripe or Clerk Billing. There
is no merchant account, no funding, and no customer yet. Billing code adds
attack surface and support burden.

## Decision

- Build a public `/pricing` page with `BILLING_ENABLED = false`.
- Do not add checkout, webhooks, or tier enforcement.
- Do not enforce free-tier limits that would break a demo.

## Consequences

- The investor demo shows a roadmap, not a checkout.
- Per-feature quotas stay unimplemented for forms.
- Billing is a deliberate later project with its own threat model.
