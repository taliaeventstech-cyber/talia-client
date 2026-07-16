# Auth Security Phase 1

Last updated: 3 June 2026

This document captures the first hardening pass for TALIA authentication. The implementation still lives in the Next.js application as a backend-for-frontend layer, but the boundaries are intentionally small so the logic can later move to a dedicated backend, edge function, or API gateway.

## Goals

- Stop creating auto-confirmed users from the application server.
- Require real email ownership before a new account can enter onboarding.
- Enforce a stronger password policy consistently in the UI, API route, and Supabase configuration.
- Add basic abuse protection around public auth endpoints.
- Avoid account enumeration through detailed auth errors.
- Add baseline browser security headers.

## Current Auth Model

- Identity provider: Supabase Auth.
- Primary sign-in method: email and password.
- Signup flow: public trial signup, followed by email confirmation, then onboarding.
- Team access flow: invite links via `signup_invites`.
- Tenant access: enforced through profiles, account memberships, venue memberships, and RLS.

## Implemented Controls

### Email Confirmation

`/auth/signup` now uses `supabase.auth.signUp` with `emailRedirectTo` instead of `admin.auth.admin.createUser`.

This means:

- Supabase owns email confirmation.
- TALIA does not mark users as confirmed from application code.
- A new user reaches the confirmation screen only after opening the confirmation link and exchanging the code in `/auth/callback`.
- `/auth/confirmed` shows that the email has been confirmed and gives the user an explicit CTA to start onboarding or enter TALIA.
- In local development, `/auth/signup` builds the callback from the real request origin when both the configured app URL and request URL are localhost values with different ports. This prevents confirmation emails from pointing to a stale local port.
- After signup, the UI replaces the form with a confirmation state instead of leaving the signup inputs visible.

### Password Policy

The application validates passwords with:

- minimum 12 characters;
- maximum 128 characters;
- at least one lowercase letter;
- at least one uppercase letter;
- at least one digit.

The local Supabase config mirrors this with:

```toml
minimum_password_length = 12
password_requirements = "lower_upper_letters_digits"
```

Production Supabase must be configured with the same policy in the dashboard or infrastructure config.

### Auth Rate Limiting

The app now applies in-process rate limits to:

- `/auth/login`;
- `/auth/signup`;
- `/auth/resend-confirmation`.

Limits are keyed by IP and normalized email. This is a first-pass protection for abuse and brute-force attempts.

Important limitation: the current limiter is process-local memory. It is acceptable as a temporary BFF control, but it is not enough for multi-instance production deployments. Move this to Redis, an edge rate limiter, WAF, or a backend service before scaling horizontally.

Supabase Auth also applies provider-level email limits. Local development uses `email_sent = 12` emails/hour to avoid blocking normal signup tests. Production should use a stricter value aligned with the real SMTP provider, support load, and abuse monitoring.

### Safer Errors

Public auth routes avoid returning detailed Supabase errors to users. Detailed messages are only logged outside production.

This reduces account enumeration and avoids exposing provider internals.

### Browser Security Headers

`next.config.ts` now adds baseline headers:

- `X-Frame-Options: DENY`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

The widget route keeps its specific cross-origin headers.

## Operational Checklist

- [ ] Enable email confirmations in production Supabase.
- [ ] Set production password minimum to 12.
- [ ] Set production password requirements to lowercase, uppercase, and digits.
- [ ] Enable secure password change / recent reauthentication in production Supabase.
- [ ] Configure production SMTP for auth emails.
- [ ] Review Supabase Auth rate limits in production.
- [ ] Verify `NEXT_PUBLIC_APP_URL` points to the production Agora URL.
- [ ] Confirm production `/auth/callback` and `/auth/reset-callback` are included in the Supabase redirect allow-list.
- [ ] Confirm `http://localhost:3000/**` is included in the hosted Supabase redirect allow-list used during local development.
- [ ] Test signup with a fresh email.
- [ ] Test password recovery in local and production, including expired-link handling.
- [ ] Test login with wrong password until rate limited.
- [ ] Test resend confirmation rate limit.

## Next Phases

### Phase 2

- Add MFA TOTP for owners/admins.
- Add account security page for password change, MFA enrollment, and Gmail disconnect.
- Add audit events for sensitive account actions.
- Notify users after password changes and new Gmail connections.

### Phase 3

- Move rate limiting to shared infrastructure.
- Add device/session management.
- Add temporary lockout for repeated credential failures.
- Add Turnstile or equivalent bot protection if abuse appears.
- Run a full RLS and tenant-isolation review.
