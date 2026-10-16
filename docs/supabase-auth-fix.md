# Fix Supabase email “Sign up” confusion

Omera has **one login** at `/login`. Supabase emails may still say **“Confirm your signup”** — that is normal for new emails.

## Dashboard settings (required)

Project → **Authentication** → **URL configuration**

| Setting | Value |
|---------|--------|
| **Site URL** | `https://vilatech-ai.vercel.app/auth/callback` |
| **Redirect URLs** | `https://vilatech-ai.vercel.app/**` |

Project → **Authentication** → **Providers** → **Email**

- Email provider **enabled**
- For easiest OTP login: turn **off** “Confirm email” if you only want magic link/OTP (optional; test after change)

Project → **Authentication** → **Email templates** → **Confirm signup**

Optional: edit body to say “Your Omera code is {{ .Token }}” and de-emphasize the link.

## User flow

1. [vilatech-ai.vercel.app/login](https://vilatech-ai.vercel.app/login)
2. Email → **Send code**
3. Enter **6-digit code** → **Verify and continue**

If they tap the email link instead, they should return to Omera `/auth/callback` then `/chat` (not a Supabase-hosted sign-up page).
