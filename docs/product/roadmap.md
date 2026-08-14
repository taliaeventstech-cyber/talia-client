# Product Roadmap

TALIA is a SaaS platform for cultural entities. The goal is not to sell a standalone chatbot, but to build an attention, data, and marketing layer for theatres, museums, cinemas, festivals, and cultural venues.

## Modules

### Attention Module

Status: active.

Channels:

- Web chatbot.
- Email agent.
- Voice agent, paused pending reactivation.
- WhatsApp and Instagram later on.

Goal:

Answer visitor questions, prepare responses, escalate to humans when needed, and generate useful data for operations.

### Data Module

Status: under construction.

Includes:

- Topics and intent.
- Metrics per channel.
- Demand signals.
- Knowledge base performance.
- Plan usage.

### Marketing Module

Status: planned.

Includes:

- Segments.
- Campaigns.
- Recommendations.
- Interest recovery and ticketing.

## Phases

### Phase 1: Stable demos

- Multi-tenant widget.
- Per-venue configuration.
- Backstage for TALIA.
- Agora for the client.
- Conversations, topics, and intent.
- Manual or imported knowledge base.

### Phase 2: Serious SaaS model

- Accounts and venues.
- Invitations by account or by venue.
- Roles and permissions.
- Modules contracted per venue.
- Limits and usage per plan.
- Backstage with client creation, editing, and deactivation.

### Phase 3: Multichannel attention

- Stable web chatbot.
- Integrated voice agent.
- Email agent with drafts in the client's mailbox.
- Unified view of conversations and insights.

### Phase 4: Data and reporting

- Aggregated dashboard per account.
- Dashboard per venue.
- Metrics per channel.
- Intent metrics.
- Exportables and monthly reporting.

### Phase 5: Marketing

- Campaign activation from insights.
- Integrations with CRM/email marketing.
- Supervised automations.

## Current Priorities

1. Consolidate self-serve onboarding and initial chatbot configuration.
2. Stabilize the Gmail email agent in supervised-drafts mode.
3. Complete Google OAuth verification.
4. Consolidate permissions by role, account, and venue.
5. Improve overview, reporting, and usage traceability.
6. Complete the EU AI Act transparency and governance work before the 2 December 2026 transition deadline for pre-existing generative systems.
7. Keep `docs/current-state.md` as a living source for team onboarding.

## Committed roadmap: EU AI Act (August-December 2026)

Scope: TALIA's current Web Agent remains a limited-transparency-risk system.
This roadmap does not authorise features that make decisions about employment,
education, essential services, biometrics, emotion recognition, law
enforcement, migration or other high-risk uses. Any proposal in those areas
requires a new legal and product assessment before implementation.

The operational classification, existing controls and release gate remain in
[`docs/compliance/eu-ai-act.md`](../compliance/eu-ai-act.md). This section is
the delivery schedule for the remaining work, not a second compliance standard.

| When | Deliverable | Owner | Done when |
| --- | --- | --- | --- |
| 14-31 August | Confirm scope and establish the AI system register | Product + Engineering | A versioned register identifies each TALIA AI system, purpose, provider/model, data categories, processing region, customer/deployer role, risk classification, human fallback, owner and approval date. The public Web Agent is explicitly classified as limited-transparency-risk. |
| 14-31 August | Produce the customer deployment guide | Product + Legal | A venue-facing checklist requires the permanent AI disclosure, a valid privacy-policy URL, human escalation details and prohibits high-risk or prohibited uses. It is included in launch/onboarding material. |
| September | Complete and evidence role-based AI literacy | Operations + Product | Everyone configuring, supporting or supervising TALIA completes the briefing. The record contains participant, role, date, material version and confirmation; onboarding for new relevant staff is defined. |
| September | Confirm production transparency baseline | Engineering + QA | Production checks prove the AI disclosure appears from the first interaction, is clear and accessible in every supported language, cannot be disabled by a venue, and the privacy link is present before a visitor sends content. |
| October | Select and design Article 50(2) marking approach | Engineering + Legal | A signed decision compares TALIA's approach with the EU Code of Practice section for providers, including machine-readable marking, detection, interoperability, robustness and evidence retention. Decide whether to adhere to the voluntary Code or document an equivalent approach. |
| November | Implement and test the selected marking approach | Engineering + QA | Every newly generated text response has the selected machine-readable mark; automated tests cover API output and rendered widget output, and evidence demonstrates effective, interoperable, robust and reliable operation as far as technically feasible. Existing `ai_generated` JSON and DOM attributes are retained only if they form part of the selected approach. |
| By 2 December | Production release and compliance pack | Engineering + Product + Legal | The production release is verified, a gap analysis against Article 50(2) is signed, test results and release evidence are retained, customer instructions are published, and the AI system register/AI-literacy record are current. |

### Ongoing release control

From August onward, no AI capability is released without the release-gate record
in `docs/compliance/eu-ai-act.md`: intended purpose, affected people,
classification, data and retention, model/provider and region, human oversight,
visitor transparency, safety/grounding/accessibility/tenant-isolation tests,
owner and approval date.

If TALIA later auto-publishes generated text on matters of public interest, or
adds generated images, audio or video, reassess the Article 50 deployment
labelling obligations before release.
