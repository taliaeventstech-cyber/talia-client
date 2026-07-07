# Google Cloud production OAuth

Operational document for taking TALIA's Gmail integration to production.

## Current problem

Google shows `Access blocked: talia-mail has not completed the Google verification process` when an unauthorized account tries to connect Gmail.

This happens because the OAuth consent screen is in testing mode, or because the app is not yet verified for the requested scopes.

## Current scopes

TALIA requests:

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.compose`

Both are restricted Gmail scopes. Google requires OAuth verification for public apps that use them. If the app stores or transmits restricted-scope data on servers, Google may require a security assessment.

## Temporary unblock for testing

In Google Cloud Console:

1. Open the current OAuth project.
2. Go to Google Auth Platform / Audience.
3. Keep the publishing status as `Testing`.
4. Add the test accounts under Test users.
5. Retry connecting Gmail.

Limitations:

- Maximum of 100 test users.
- Test user authorizations expire after 7 days if scopes outside profile/email/openid are used.
- Not a viable solution for real clients.

## Recommended production setup

Create a separate Google Cloud project for production.

1. Create project `talia-production`.
2. Enable the Gmail API.
3. Configure Google Auth Platform.
4. User type: `External`, unless the product is only for an internal Google Workspace.
5. Branding:
   - App name: `TALIA` or `GoTalia`.
   - User support email.
   - Logo.
   - Public home page.
   - Public privacy policy.
   - Public terms of service.
   - Authorized domain: final production domain.
6. Data access:
   - Declare only `gmail.readonly` and `gmail.compose`.
   - Justify why they are needed.
7. OAuth client:
   - Type: Web application.
   - Authorized redirect URI:
     - `https://APP_PROD_DOMAIN/api/email/google/callback`
   - Authorized JavaScript origins:
     - `https://APP_PROD_DOMAIN`
8. Publish the app as `In production`.
9. Request branding and data access verification.

## Production environment variables

Configure in the environment where Next runs:

```bash
NEXT_PUBLIC_APP_URL=https://APP_PROD_DOMAIN
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
EMAIL_OAUTH_STATE_SECRET=...
EMAIL_TOKEN_ENCRYPTION_KEY=...
```

`NEXT_PUBLIC_APP_URL` is critical: the code generates the redirect URI as:

```text
${NEXT_PUBLIC_APP_URL}/api/email/google/callback
```

That value must match exactly the redirect URI authorized in Google Cloud.

## Evidence for verification

Prepare before submitting the request:

- Public URL of the app.
- Privacy policy with explicit mention of Gmail data.
- Terms of service.
- Short video showing:
  - login in TALIA;
  - connecting Gmail;
  - reading the authorized inbox;
  - creating a draft;
  - disconnection/revocation.
- Explanation of data usage:
  - authorized emails are read to classify and prepare replies;
  - supervised drafts are created;
  - TALIA does not send emails automatically with the current scope;
  - OAuth tokens are stored encrypted;
  - the user can disconnect the account.

## App deployment

The Next frontend/backend can run on Cloud Run, Vercel, or another hosting provider. What matters for Google OAuth is:

- a stable HTTPS domain;
- a stable redirect URI;
- public privacy and terms pages;
- a verified production OAuth project.

If deployed on Google Cloud, Cloud Run is the most straightforward option for this app.

## Official references

- OAuth App Verification: https://support.google.com/cloud/answer/13463073
- Manage App Audience: https://support.google.com/cloud/answer/15549945
- Gmail API scopes: https://developers.google.com/workspace/gmail/api/auth/scopes
- Submit app for verification: https://support.google.com/cloud/answer/13461325
- Restricted scope verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
