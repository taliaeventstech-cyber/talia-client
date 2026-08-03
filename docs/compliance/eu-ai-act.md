# EU AI Act operational checklist

Last updated: 2 August 2026

## System classification

TALIA's current public cultural-information chatbot is treated as a limited-transparency-risk AI system. It is not intended to make decisions about employment, education admission, access to essential public/private services, law enforcement, migration, biometrics or emotion recognition.

Reassess classification before enabling any of those uses or before allowing automated decisions with legal or similarly significant effects.

## Roles

- TALIA: provider of the integrated chatbot system and downstream user of general-purpose AI models.
- Customer venue: deployer of the configured chatbot on its website.
- OpenAI or another model supplier: upstream general-purpose AI provider, according to the selected runtime.

## Controls

| Control | Status | Evidence/action |
| --- | --- | --- |
| Article 50 first-interaction disclosure | Implemented | Permanent “Web agent” identity plus an explicit AI disclosure in `public/widget.js` |
| Accessible, distinguishable information | Implemented | Visible text plus `aria-describedby` before message submission |
| Privacy information | Implemented | Customer-configurable HTTPS privacy-policy link; the 90-day retention period is documented in the linked policy rather than repeated in the widget |
| Machine-readable identification | Baseline implemented | `ai_generated: true` in chat responses and `data-ai-generated="true"` in rendered assistant messages |
| Article 50(2) final technical alignment | Due by 2 December 2026 for the pre-existing system | Review the Commission Code of Practice and applicable interoperability standard; custom attributes alone must not be treated as final conformity evidence |
| AI literacy | Operational action required | Complete and record role-based training described below |
| Prohibited-practice review | Implemented by product scope | No manipulation, social scoring, biometric categorization, emotion recognition or prohibited scraping intended |
| Human oversight/fallback | Implemented | Configurable verified contacts and supervised email drafts |
| AI inventory | Implemented in architecture docs and subprocessor list | Review on each model/provider change |

## Minimum AI-literacy record

Every person configuring, supporting or supervising TALIA should complete a short briefing covering:

1. What TALIA can and cannot do.
2. Hallucination, outdated-information and prompt-injection risks.
3. When to use a verified fallback or human escalation.
4. Prohibition on entering unnecessary personal or sensitive data.
5. How to report harmful, discriminatory, insecure or incorrect behavior.
6. The distinction between generated suggestions and verified official information.

Record the participant, role, date, material version and confirmation of completion. Repeat after material product changes and at least annually.

## Release gate

Before releasing a new AI capability, record:

- intended purpose and affected people;
- provider/deployer roles;
- risk classification;
- data categories and retention;
- model/provider and transfer locations;
- human oversight and fallback;
- transparency shown to the affected person;
- tests for safety, grounding, accessibility and tenant isolation;
- owner and approval date.

## Official references

- [European Commission guidance on Article 50 transparency obligations](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems)
- [Article 50 — Transparency obligations](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50)
- [Article 4 — AI literacy](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-4)
- [Commission FAQ on Article 50 and the transitional period](https://digital-strategy.ec.europa.eu/es/faqs/transparency-obligations-under-article-50-ai-act)
