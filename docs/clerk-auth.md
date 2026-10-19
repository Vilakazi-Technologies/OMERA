# Clerk authentication (Omera)

**Sign-in is Clerk only.** There is no Supabase Auth, magic links, or OTP in this app.

## Environment variables

Set on **Vercel** (Production, Preview, Development) and in `.env.local` for local dev:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/chat
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/chat
APP_ORIGIN=https://vilatech-ai.vercel.app
```

In the [Clerk Dashboard](https://dashboard.clerk.com):

1. **Domains** — allow `vilatech-ai.vercel.app` and `localhost`.
2. **User & authentication** — turn **off Phone** (use Email + Google/Apple/GitHub only). Phone OTP often fails on non‑US numbers and blocks sign-in.
3. When you go live, switch from `pk_test_` / `sk_test_` to **Production** keys so the orange “Development mode” banner disappears.

## User flow

1. `/login` or `/sign-up` — Clerk UI  
2. After auth → `/chat`  
3. APIs use `requireIdentity()` (Clerk session)

Optional: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` enable **cloud sync** for chats/forms (data only, not login). Without them, the app runs in **local** persistence mode.
