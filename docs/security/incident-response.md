# Security incident response

Owner: TALIA engineering and security  
External privacy contact: `legal@talia.events`  
Review cadence: every six months and after every SEV-0 or SEV-1 incident

## Purpose and scope

This runbook covers security, privacy and availability incidents affecting
Agora, Backstage, the public widget, Supabase, `talia-ai`, Google OAuth/Gmail,
Microsoft Graph, OpenAI, Vercel or Fly.io. It is especially strict for Google
Workspace data, OAuth credentials and cross-tenant access.

Do not place message bodies, OAuth tokens, customer exports or other personal
data in Linear, GitHub issues, chat rooms or postmortems. Store restricted
evidence only in the approved company security workspace.

## Roles

| Role | Responsibility |
| --- | --- |
| Incident Commander | Owns severity, timeline, decisions and hand-offs. Must be a founder or explicitly delegated engineer. |
| Technical Lead | Investigates, contains, eradicates and restores the affected systems. |
| Privacy/Legal Lead | Determines controller/processor duties, regulatory and customer notifications, and approves external wording. |
| Communications Lead | Coordinates customer and public communication after Legal approval. |
| Scribe | Maintains the timestamped incident record and evidence index. |

The restricted contact sheet must name a primary and backup person for every
role. The Incident Commander must not investigate alone when Gmail-derived data,
OAuth credentials or more than one tenant may be affected.

## Severity and response targets

| Severity | Examples | Acknowledge | Initial containment target |
| --- | --- | ---: | ---: |
| SEV-0 Critical | Confirmed unauthorized Google data/token access; cross-tenant disclosure; active credential exfiltration; destructive production compromise | 15 min | 1 hour |
| SEV-1 High | Credible suspected unauthorized access; exposed secret without confirmed use; major authentication bypass; material loss of availability | 30 min | 4 hours |
| SEV-2 Medium | Contained vulnerability or limited incident with no evidence of sensitive-data access | 4 business hours | 1 business day |
| SEV-3 Low | Minor security defect, failed control or suspicious event with negligible impact | 2 business days | Planned remediation |

These are internal response targets, not substitutes for legal notification
deadlines.

## First 30 minutes

1. Open a restricted incident record named `SEC-YYYYMMDD-NN` and record who
   reported it, the first known timestamp and affected systems.
2. Assign Incident Commander, Technical Lead, Privacy/Legal Lead and Scribe.
3. Preserve only the minimum evidence needed: request IDs, deployment IDs,
   sanitized logs, audit-event IDs and provider event timestamps.
4. Classify whether Google Workspace data, OAuth tokens, personal data,
   multiple tenants or privileged accounts may be involved.
5. Stop further exposure before pursuing root cause. Do not delete logs or
   affected rows unless necessary to stop active harm.

## Containment playbooks

### Google OAuth or Gmail data

1. Stop the email scheduler and set affected `email_connections` to a
   non-syncing state.
2. Revoke the affected Google grants. If scope is uncertain, revoke all TALIA
   grants and require controlled reconnection.
3. Rotate the Google OAuth client secret, internal API keys and cron secret if
   they may be exposed.
4. Treat compromise of `EMAIL_TOKEN_ENCRYPTION_KEY` as compromise of every
   token encrypted by that key. Revoke grants before replacing the key; do not
   rotate it blindly and make existing tokens undecryptable without a plan.
5. Query `audit_events`, connection timestamps and provider logs using IDs and
   time ranges. Do not export complete mailboxes into the incident record.

Google's Workspace API User Data Policy requires prompt notification to
`security@google.com` for known or suspected unauthorized access to systems
where Google data is stored. Notify Google before making public statements and
cooperate with its remediation requests.

### Cross-tenant access

1. Disable the affected route or module globally if the tenant boundary is not
   proven safe.
2. Preserve the authorization decision, request ID, actor ID, target tenant ID
   and affected row IDs without copying row contents.
3. Check browser privileges, RLS, server authorization and service-role write
   paths independently.
4. Identify every affected tenant before re-enabling the route.

### Leaked application secret

1. Disable or rotate the credential at its source provider.
2. Update Vercel, Fly.io, Supabase or Google configuration as applicable.
3. Redeploy/restart every runtime that cached the old value.
4. Search sanitized access logs for use from the earliest possible exposure.
5. Revoke dependent sessions, grants or encrypted material when rotation alone
   does not invalidate them.

### Malicious or broken deployment

1. Stop automatic promotion of the affected commit.
2. Use Vercel Instant Rollback for Agora or deploy the last known-good `talia-ai`
   image on Fly.io.
3. Confirm `/health`, authentication, one tenant-isolation check and one
   controlled Gmail operation before declaring recovery.

## Assessment and notification

The Privacy/Legal Lead records:

- incident nature, affected systems, data categories and approximate subjects;
- whether TALIA acts as controller or processor for each affected dataset;
- likely consequences and mitigations;
- discovery, confirmation, containment and recovery timestamps;
- required recipient, deadline, owner and delivery evidence.

Where TALIA is a processor, notify the affected customer/controller without
undue delay according to the DPA. Where GDPR applies and notification is
required, the controller's supervisory-authority deadline is generally 72 hours
after awareness. For relevant incidents in Brazil, the controller may have a
three-business-day ANPD/data-subject deadline. Mexican law requires significant
security breaches affecting patrimonial or moral rights to be communicated to
affected data subjects. Legal must validate applicability; engineering must not
delay escalation while waiting for complete facts.

## Recovery and closure

1. Remove the root cause and deploy through normal review and CI.
2. Restore from a known-good backup only when integrity cannot be proven.
3. Validate tenant isolation, OAuth state, token refresh, revocation and audit
   trails with controlled accounts.
4. Monitor the affected path for at least 24 hours after SEV-0/SEV-1 recovery.
5. Complete a blameless postmortem within five business days, including root
   cause, timeline, impact, control failures, corrective actions and owners.
6. Keep the incident register and notification evidence for the period required
   by applicable law. Brazil requires personal-data incident records to be kept
   for at least five years.

## Required exercises and evidence

- Semiannual tabletop: leaked Google refresh token plus cross-tenant suspicion.
- Annual technical exercise: stop sync, revoke a controlled Google grant,
  rotate a non-production secret and restore service.
- Evidence: participants, timestamps, decisions, screenshots with secrets
  redacted, action items and closure dates.

## Official references

- Google Workspace API User Data Policy:
  https://developers.google.com/workspace/workspace-api-user-data-developer-policy
- GDPR Article 33:
  https://eur-lex.europa.eu/eli/reg/2016/679/oj
- Brazil ANPD incident communication:
  https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis
- Mexico LFPDPPP:
  https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf
