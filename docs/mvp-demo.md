# Omera MVP — investor demo checklist

Use this before a live demo. The **product** (sign-in, chat, model picker, delete with confirm, thinking state) is MVP-ready. **Speed and consistency** depend on which AI backend is configured.

## What to show (5 minutes)

1. Landing → **Sign up** / **Sign in** (Clerk).
2. **Chat** → **Omera · Xavani** → ask one business question (see script below).
3. Point out **Omera is thinking** while the model warms up.
4. **New chat** → second question → show history + **delete** (confirmation dialog).
5. Optional: **Form fill** upload (if Supabase + analyze are configured).

## Demo script (questions that work well)

- “Help me validate a business idea before I spend money.”
- “Help me improve pricing and cash flow.”
- “What should I do this week to get my first paying customer?”

## Why replies can feel slow today

Production is on **OpenRouter** with a **free/shared model** until **Xavani (Shivani)** is linked on Vercel (`XAVANI_*`). Free models are queued and can take **15–45 seconds** before the first words appear. That is normal for $0 inference—not a broken app.

## Make the demo fast (recommended before investors)

| Priority | Action |
|----------|--------|
| **Best** | Shivani team provides hosted **Xavani** URL + key → set `XAVANI_BASE_URL`, `XAVANI_API_KEY`, `XAVANI_MODEL=omera` on Vercel → redeploy. |
| **Good** | On Vercel, set `OPENROUTER_MODEL` to a **fast** model (e.g. `google/gemini-2.5-flash-lite` or a small paid Flash model). Redeploy. |
| **Good** | Add a small **OpenRouter credit** ($5–10) and use a paid fast model for the demo day only. |
| **UI** | Only **Omera · Xavani** is shown (third-party models hidden). |

Optional: `OPENROUTER_MAX_TOKENS=1200` on Vercel for shorter, faster answers in demos.

## Reliability on the free tier (built in)

- Chat **auto-retries** up to 3 times with backup models if a reply fails or comes back empty.
- OpenRouter requests include a **model fallback chain** when the primary is busy.
- **Google research** runs in the background with a short time cap so answers still stream if search is slow.
- Signed-in users get a higher default **chat quota** (150 requests) for demo sessions.

Funding unlocks paid inference (Xavani hosting + token budget)—that is what removes queue delays, not more UI work.

## Verify before the meeting

```text
GET https://vilatech-ai.vercel.app/api/health
```

- `chat.configured`: `true`
- `chat.provider`: `xavani` (ideal) or `openrouter` (interim)
- `chat.primaryLabel`: `Omera · Xavani`

```text
GET https://vilatech-ai.vercel.app/api/ai/models
```

Confirm the primary model description matches the model you intend to demo.

## What is “done” vs “next”

| Area | MVP demo | Production scale |
|------|----------|------------------|
| Auth (Clerk) | Done | Done |
| Chat UI + streaming | Done | Done |
| Omera persona | Done (system prompt) | Shivani/Xavani + tuning |
| Speed | Depends on model/hosting | Xavani + paid/fast route |
| Forms filled PDF | Partial | Shivani / eng backlog |
| 11 languages voice | Partial | Lelapa + keys |

**Bottom line for investors:** You are demoing a **real product** on a **real stack**; inference is the variable cost line (tokens / Xavani hosting), not unfinished UI.
