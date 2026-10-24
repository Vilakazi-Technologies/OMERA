# Monetizing Omera (investor & product roadmap)

Omera is built to become a **South African-born AI workspace**: chat, voice, forms, spreadsheet analysis, and (with funding) a dedicated **Shivani/Xavani** model — not a clone of ChatGPT on day one, but a focused product businesses will pay for.

## What investors are really buying

| Layer | MVP (today) | Funded scale |
|-------|-------------|--------------|
| **Model** | OpenRouter (shared/free tiers) | Hosted Xavani + paid inference |
| **Data** | User chats/forms/CSV in Supabase | Same + enterprise isolation |
| **Features** | Chat, Google research, PDF forms, CSV analyser | Excel native, teams, API, SLAs |

Funding goes to **tokens, hosting, and engineering** — not to “training on everything.”

## Suggested pricing (when you turn on billing)

Use **Clerk Billing** or **Stripe** later; structure now:

### Free — “Start”
- Limited chat messages / day
- 3 CSV analyses / month
- 1 form session / month
- Community support

### Pro — **R299–R499 / month** (solo founder / SMME)
- Higher chat + voice limits
- Unlimited CSV analyses (fair use)
- Google research on every message
- Cloud sync & history
- Priority OpenRouter / paid model slot

### Business — **R1,499+ / month** (teams)
- Multiple seats (Clerk Organizations)
- Shared form templates
- Export & audit trail
- Dedicated support

### Enterprise — custom
- Private Xavani deployment
- POPIA-aligned data residency conversations
- Custom integrations (WhatsApp, ERP, banks)

## Revenue beyond subscriptions

- **Per-seat** B2B (accountants, consultants running client CSV reviews)
- **API** access for partners
- **White-label** Omera for franchises / municipalities
- **Professional services** (setup, form digitization)

## What to demo to investors **this week**

1. **Chat** with Google research (VILATECH story).
2. **Spreadsheet analyser** — upload CSV → pick goal → charts + next steps.
3. **Form fill** — voice-friendly PDF workflow.
4. **Roadmap slide**: Free → Pro → Xavani-hosted “Omera brain.”

## Technical next steps for monetization

1. Clerk **Organizations** + roles for Business tier.
2. Enforce limits in `consumeQuota` per feature (chat vs CSV vs forms).
3. Stripe or Clerk Billing checkout on `/pricing`.
4. Feature flags: `PRO_CSV_UNLIMITED`, `PRO_MODEL=...`.

This document is product strategy — wire payments when you are ready to charge; the quota hooks already exist for chat and CSV.

## Implementation status (2026-10-24)

- Pricing page: `/pricing`, with `BILLING_ENABLED = false`.
- Checkout: not wired. Stripe and Clerk Billing need an account and a merchant
  decision.
- Per-feature quotas: chat and CSV call `consumeQuota`. Forms do not.
- Tier enforcement: not built. Free limits would break demos before billing
  exists.
- Decision record: `docs/decisions/ADR-0005-no-billing-until-funding.md`.
