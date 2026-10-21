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
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/chat
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/chat
APP_ORIGIN=https://vilatech-ai.vercel.app
```

In the [Clerk Dashboard](https://dashboard.clerk.com):

1. **Domains** — allow `vilatech-ai.vercel.app` and `localhost` (and your preview URLs if needed).
2. **User & authentication** — turn **off Phone** (use Email + Google/Apple/GitHub only). Phone OTP often fails on non‑US numbers and blocks sign-in.
3. **Email verification** — keep verification **on** for production trust.
4. **Paths → Redirect URLs** (or Email settings → after verification):
   - After email link is clicked, send users to:  
     `https://vilatech-ai.vercel.app/auth/email-confirmed`  
     (local: `http://127.0.0.1:3000/auth/email-confirmed`)
5. When you go live, switch from `pk_test_` / `sk_test_` to **Production** keys so the orange “Development mode” banner disappears.

## Intended user flow

1. **Sign up** at `/sign-up` → Clerk collects email/password or social login.
2. **Verify email** → user opens the link from their inbox.
3. **Land on** `/auth/email-confirmed` with clear copy: “Sign in with the same email.”
4. **Sign in** at `/login?from=email-confirmed` → green notice + Clerk sign-in → **`/chat`** automatically.

If Clerk completes verification while the user is still in the embedded sign-up UI, they may go straight to `/chat` — both paths are supported.

## OAuth (Google / Apple / GitHub)

Omera includes SSO callback routes:

- `/login/sso-callback`
- `/sign-up/sso-callback`

In Clerk Dashboard → **Social connections**, ensure redirect URLs match your domain.

## Cloud sync (optional)

`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` enable **cloud sync** for chats/forms (data only, not login). Without them, the app runs in **local** persistence mode.

## APIs

After auth, APIs use `requireIdentity()` (Clerk session). `APP_ORIGIN` must match the live site exactly (no trailing slash).
