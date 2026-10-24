# Privacy and POPIA posture

This document describes the data Omera handles. It is not legal advice and makes
no certification claim. Legal review is an owner input.

## Data map

| Data | Where | Purpose |
|---|---|---|
| Clerk user id | `omera_users.auth_user_id` | Identity mapping |
| Email | `omera_users.email` | Account contact |
| Chat messages | `omera_messages` | Product function |
| Form definitions and answers | `omera_form_sessions` | Form completion |
| Uploaded documents | `omera-forms` bucket | Form completion |
| Audio | not stored | Transcription only |
| Health and quota counters | `omera_request_counts` | Abuse control |

## Purpose

Provide a business adviser chat and a form completion service. No advertising,
no model training on customer data, no sale of data.

## Lawful basis

To confirm with the operator and legal reviewer. The working position:

- Account data: contract.
- Product content: contract.
- Abuse and security data: legitimate interest.

## Sub-processors

| Processor | Purpose | Location |
|---|---|---|
| Clerk | Identity | United States |
| Supabase | Database and storage | Project region, owner to record |
| Vercel | Application hosting | United States and edge |
| Render | Xavani hosting | Owner to record |
| Lelapa | Speech transcription | South Africa |
| Model provider | Inference | Owner to record |

## Cross-border transfer

Several processors operate outside South Africa. POPIA section 72 requires
appropriate safeguards. Record the chosen mechanism before customer use:
contractual clauses, consent, or a adequacy decision. Owner and legal decision.

## Retention

No automatic purge job exists. Data persists until deleted in the product or by
the operator. A retention schedule is an owner decision. Record it in
`docs/operations.md` before customer use.

## Data subject requests

1. Receive the request through the owner or the product.
2. Verify identity.
3. Export or delete the data through the operator path.
4. Record the request, the action, and the date. Do not store the request text
   in logs.

Deletion covers rows plus private objects. Processor-side copies need a manual
request to each processor.

## Breach

Follow `docs/security/incident-response.md`. The operator decides on notice to
the Information Regulator and to affected people, with legal advice. Notify as
soon as reasonably possible after discovery.

## Open inputs

- Lawful basis confirmation.
- Retention schedule.
- Cross-border mechanism.
- Processor region records.
- Legal reviewer.
