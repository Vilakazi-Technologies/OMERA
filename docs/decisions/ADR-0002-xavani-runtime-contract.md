# ADR-0002 — Xavani runs under a strict contract

- Status: accepted
- Date: 2026-10-15

## Context

Omera must not expose provider keys, and the chat path must stay predictable.
A general-purpose agent runtime can execute tools, read files, and persist
transcripts.

## Decision

Xavani runs with `omera_mode: true`:

- `tools_enabled: false`
- `memory_enabled: false`
- `context_files_enabled: false`
- `transcript_persistence: false`
- one bearer service key
- contract version 1 at `GET /v1/capabilities`

Omera verifies the contract before every chat. A mismatch is rejected as
`UNSAFE_XAVANI_SERVICE`.

## Consequences

- Provider keys live only on the Xavani host.
- The model cannot act on fetched web text.
- Research runs server-side before the model call.
- The contract test is part of the Omera suite.
