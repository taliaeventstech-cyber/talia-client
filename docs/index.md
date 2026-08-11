# TALIA Documentation Index

This directory holds the curated documentation for product, architecture, requirements, security, legal and operations.

## Main Entry Point

- [`current-state.md`](current-state.md): real state of the app, active modules, legacy and known debt.

## Product

- [`product/roadmap.md`](product/roadmap.md): vision by phases and modules.
- [`product/pricing.md`](product/pricing.md): plans, limits and monetization criteria.
- [`product/onboarding.md`](product/onboarding.md): self-serve signup flow, accounts, venues and team invitations.
- [`product/accessibility-widget.md`](product/accessibility-widget.md): initial exploration of the accessibility widget.
- [`product/branding.md`](product/branding.md): product design system. Mandatory reference document for the code agent on any UI change.

## Competitive Research

- [`product/competitive-docsbot.md`](product/competitive-docsbot.md): comparative analysis of TALIA vs DocsBot AI. Point-in-time snapshot, not a roadmap.
- [`product/competitor-pricing-research.json`](product/competitor-pricing-research.json): pricing research on direct competitors in the cultural sector (Ask Mona, Nevent.ai, CultureBot.eu, Anolla, ChatbotKit).

## Architecture

- [`architecture/accounts-venues-access.md`](architecture/accounts-venues-access.md): accounts, venues, profiles, roles and invitations.
- [`architecture/usage-billing.md`](architecture/usage-billing.md): usage measurement, limits and billing.
- [`architecture/ai-agents.md`](architecture/ai-agents.md): shared principles for chatbot, email, voice and future channels.
- [`architecture/channel-agent-contracts.md`](architecture/channel-agent-contracts.md): executable channel-agent boundaries, event vocabulary, permissions and retention matrix.
- [`architecture/agent-runtime.md`](architecture/agent-runtime.md): internal runtime contract to decouple n8n/own backend.
- [`architecture/talia-ai-service.md`](architecture/talia-ai-service.md): spec of the separate `talia-ai` repo for Fly.io.
- [`architecture/knowledge-ingestion.md`](architecture/knowledge-ingestion.md): ingestion of FAQs, Excel, PDFs, URLs and future retrieval layer.
- [`architecture/ticketing-integrations-prestudy.md`](architecture/ticketing-integrations-prestudy.md): prestudy for public API and ticketing connector architecture.
- [`architecture/scaling-roadmap-lisbon-2026.md`](architecture/scaling-roadmap-lisbon-2026.md): scalable architecture plan toward November 2026.

## Requirements

- [`requirements/chatbot.md`](requirements/chatbot.md): web chatbot and widget.
- [`requirements/email-agent.md`](requirements/email-agent.md): email agent and connection with real mailboxes.
- [`requirements/voice-agent.md`](requirements/voice-agent.md): voice agent, telephony and ElevenLabs/Twilio.

## Operations

- [`operations/client-launch-checklist.md`](operations/client-launch-checklist.md): internal checklist for launching a client.
- [`operations/git-sync-workflow.md`](operations/git-sync-workflow.md): post-merge synchronization for `talia-client` and `talia-ai`, including VS Code Git Graph.
- [`operations/google-cloud-production-oauth.md`](operations/google-cloud-production-oauth.md): Google OAuth verification for Gmail.
- [`operations/production-email-scheduler-and-casa-evidence.md`](operations/production-email-scheduler-and-casa-evidence.md): production scheduler, sensitive-access boundaries and CASA-038 evidence runbook.
- [`operations/data-retention.md`](operations/data-retention.md): operational data retention and cleanup policy.
- [`legal/data-processing-agreement.md`](legal/data-processing-agreement.md): base customer DPA for GDPR, LGPD and LFPDPPP processing roles.
- [`legal/subprocessors.md`](legal/subprocessors.md): current service-provider and international-processing list.
- [`legal/regional-notice-mexico-es.md`](legal/regional-notice-mexico-es.md): Mexico chatbot privacy-notice template.
- [`legal/regional-notice-brazil-pt-br.md`](legal/regional-notice-brazil-pt-br.md): Brazil chatbot privacy-notice template.
- [`compliance/eu-ai-act.md`](compliance/eu-ai-act.md): operational AI Act classification, controls and release gate.
- [`operations/disaster-recovery.md`](operations/disaster-recovery.md): backup inventory, recovery targets and restore exercises.
- [`operations/knowledge-embeddings.md`](operations/knowledge-embeddings.md): operational cron/backfill for embeddings.

## Security and Legal

- [`security/auth-phase-1.md`](security/auth-phase-1.md): first phase of signup/signin hardening.
- [`security/casa-readiness.md`](security/casa-readiness.md): CASA Tier 2 control and evidence register.
- [`security/incident-response.md`](security/incident-response.md): security and privacy incident runbook.
- [`security/vulnerability-management.md`](security/vulnerability-management.md): intake, severity and remediation SLAs.
- [`legal/privacy-policy-google-en.md`](legal/privacy-policy-google-en.md): current privacy policy for Google OAuth.
- [`legal/terms-of-service-google-en.md`](legal/terms-of-service-google-en.md): current terms of service.

## Other

- [`backlog.md`](backlog.md): non-blocking debt and improvements.
- [`stripe-checkout.md`](stripe-checkout.md): Stripe Checkout and webhook configuration.

## Product Naming

- **Backstage**: TALIA's internal panel.
- **Account**: contracted client or organization.
- **Venue**: theatre, museum, hall or site managed within an account.
- **Agora**: operational dashboard of a venue.
- **Account dashboard**: aggregated dashboard of an account with multiple venues.

## Principles

- TALIA uses self-serve signup to create the first workspace.
- Invitations are for existing teams.
- Contracted modules are defined per venue.
- An account can have one or several venues.
- People and emails are subject to turnover; the model must allow linking, unlinking and changing access without breaking history.
- Attention channels are adapters over a common core: knowledge, conversations, permissions, metrics and limits.
