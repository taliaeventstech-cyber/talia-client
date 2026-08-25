# Backstage multi-factor authentication

## Control objective

Every TALIA platform account with access to the exposed Backstage administrative
interface must use a second authentication factor. There are no role-based MFA
exceptions for platform owners, administrators, or support users.

## Implementation

- Supabase Auth manages the primary session and TOTP factors.
- Platform authorization is resolved server-side from `platform_admins`.
- `requirePlatformAdmin()` rejects an authenticated administrative session unless
  its Authenticator Assurance Level is `aal2`.
- Administrators at `aal1` are redirected to `/backstage-mfa`.
- Administrators without a verified factor must enroll TOTP and verify the first
  six-digit code. Existing factors are challenged on every new `aal1` session.
- Platform administrators using privileged access to a tenant surface are subject
  to the same `aal2` requirement.
- Customer tenant users are not granted Backstage access.
- TOTP enrollment starts and successful MFA verifications are recorded in
  `audit_events` without storing codes, secrets, QR content, or session tokens.

## Production configuration

TOTP enrollment and verification must be enabled in the production Supabase Auth
MFA settings before deployment. The repository's local Supabase configuration
enables both options as the expected baseline.

## CASA 3.3.1 evidence checklist

1. Screenshot the production Supabase TOTP MFA configuration without secrets.
2. Sign in as the dedicated CASA platform administrator and capture the forced MFA
   enrollment screen.
3. Capture successful TOTP enrollment and the subsequent Backstage access.
4. Sign out, sign in again, and capture the mandatory TOTP challenge.
5. Attempt to open `/backstage` at `aal1` and record the redirect to
   `/backstage-mfa`.
6. Attach the green CI run for the deployed commit and identify the production SHA.

Do not include the TOTP secret, QR code, session cookies, access tokens, recovery
codes, or personal administrator data in exported evidence.

## Account recovery

If an administrator loses every enrolled authenticator, the factor must not be
bypassed in the application. A founder with authorized Supabase organization
access must verify the requester's identity through an approved out-of-band
channel, remove the lost factor from Supabase Auth, and record the recovery as a
security event. The next Backstage login then forces a new TOTP enrollment. This
procedure must be performed by a different authorized person from the requester
and retained with the incident evidence.
