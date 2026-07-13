# Email Agent Canary

This runbook validates the `talia-ai` email classifier and drafter on one
mailbox without changing the provider for every tenant.

## Preconditions

- The mailbox is connected and synchronization works.
- `TALIA_AI_BASE_URL` and `TALIA_AI_INTERNAL_API_KEY` are configured.
- The mailbox has `draft_mode = agora_review` for the first sample.
- The global `EMAIL_AGENT_PROVIDER` can remain `n8n` for mailboxes that have not
  been migrated yet.

## Start the canary

1. Open the venue in Backstage and go to the Email agent section.
2. Set `Motor del agente` to `TALIA AI`. This writes the override only to that
   connection.
3. Keep automatic sending disabled. TALIA only creates supervised drafts.
4. Synchronize and process a small, representative email sample.
5. Review the classifier and drafter traces separately in Backstage.

Backstage summarizes the latest 25 executions without sending their raw email
content to the browser. A successful TALIA AI execution means every executed
phase used `talia-ai`, with no fallback and no processing error.

There is no automatic n8n fallback. A TALIA AI failure is recorded as an error
so the canary cannot appear healthy because the legacy provider answered.

## Promotion criteria

- no provider or contract errors;
- no unexpected fallback to n8n;
- classifier decisions match the configured topics and review rules;
- generated drafts use only verified knowledge and contacts;
- draft language matches the inbound email;
- sensitive cases remain marked for human review;
- no email is sent automatically.

After the initial sample passes, `draft_mode` can move to `provider_drafts` for
the same mailbox so drafts appear in Gmail or Outlook for human review.

## Rollback

During the migration window, set `Motor del agente` to `n8n legacy` for an
explicit mailbox-level rollback. This is temporary: after all canary mailboxes
pass, the n8n selector, adapters, variables and workflows are removed. Use
`inherit` only when the global provider is known and intentional.

Do not enable a shadow comparison that sends the same email body to both
providers. Sequential samples and supervised review provide the required
evidence with less processing of mailbox data.

## Final n8n decommission

After every migrated mailbox passes:

1. set the global email provider to `talia-ai` and remove per-mailbox legacy
   overrides;
2. replace the n8n sync wake-up job with a managed scheduler calling
   `/api/cron/email/sync`;
3. remove n8n classifier/drafter adapters and webhook configuration from
   `talia-client`;
4. delete the email workflows and their credentials from n8n;
5. remove `EMAIL_AGENT_PROVIDER` once provider selection is no longer needed.

The migration is complete only when email classification, drafting and sync do
not require an active n8n instance.
