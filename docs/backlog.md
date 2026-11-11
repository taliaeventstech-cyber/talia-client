# Backlog

Medium-term tasks and improvements that don't block current progress, but shouldn't be lost track of.

## Agent architecture

### Separate editable prompts from technical prompts

Status: pending

Context:
- The knowledge base is shared per venue.
- Each channel has its own configuration: Chatbot, Email, Voice.
- `talia-ai` agents also have technical system prompts.

Improvement:
- Explicitly distinguish between `channelPrompt` and the agent's technical instructions.
- `channelPrompt`: editable from product/backstage; defines tone, preferences, and channel behavior.
- Technical prompt: lives in `talia-ai`; contains hard rules, output format, safety limits, and the JSON contract.

Rationale:
- Prevents a user from breaking the agent's technical contract.
- Maintains traceability per channel.
- Allows sharing knowledge without mixing it with behavior.

Affected channels:
- Chatbot: `theatres.system_prompt`.
- Email: `email_connections.metadata.email_agent_settings.channel_prompt`.
- Voice: `theatres.voice_system_prompt`.

Pending decision:
- Whether to internally rename the chatbot's `system_prompt` to a clearer name in a future migration.
- Whether to add versioning/audit trail for prompt changes per channel.
