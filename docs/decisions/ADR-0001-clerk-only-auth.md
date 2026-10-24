# ADR-0001 — Clerk is the only identity provider

- Status: accepted
- Date: 2026-10-17
- Supersedes: Supabase Auth with email OTP

## Context

The first build used Supabase Auth with email OTP. Two auth systems created
duplicate identity rows, two email deliverability paths, and a confusing login.
Clerk adds organizations and roles, which the Business tier needs later.

## Decision

Clerk handles sign-in and sessions. Supabase stores data only. No route accepts
a Supabase auth token as identity. The legacy `omera_uid` cookie is fail-closed.

## Consequences

- One identity source. `omera_users.auth_user_id` stores the Clerk id.
- Legacy rows stay outside the new mapping.
- Supabase email templates and OTP routes are removed.
- `docs/clerk-auth.md` is the setup reference.
