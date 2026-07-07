# Client Launch Checklist

Internal checklist for activating a client in TALIA.

## 1. Account

- Create account in Backstage.
- Validate business name.
- Add billing email.
- Define status: trialing or active.

## 2. Venues

For each venue:

- Create venue.
- Define type.
- Define primary language.
- Define official website.
- Define fallback email.
- Define fallback phone number.
- Select plan.
- Activate contracted modules.

## 3. Chatbot

- Configure widget color.
- Configure initial message.
- Define base prompt.
- Add allowed URLs.
- Load FAQs or sources.
- Test demo locally/on landing page.
- Insert script on the client's website.
- Verify CORS and response.

## 4. Voice

If applicable:

- Activate voice module.
- Create ElevenLabs agent.
- Save `elevenlabs_agent_id`.
- Save `voice_id`.
- Choose telephony model.
- Configure TALIA number or call forwarding.
- Save operational notes.
- Make a test call.
- Verify transcript and usage.

## 5. Email

If applicable:

- Confirm provider: Google or Microsoft.
- Validate mailbox to connect.
- Define mode: drafts or review in Àgora.
- Review OAuth permissions.
- Test with an incoming email.
- Confirm that a draft appears.

## 6. Access

- Create an invitation per account if the client has multiple venues.
- Create an invitation per venue if only one venue is needed.
- Assign the correct role.
- Confirm that the user lands on the correct dashboard.
- Revoke leftover invitations.

## 7. Final Validation

- Conversations are saved correctly.
- Topics/intents are classified.
- Plan usage logs events.
- Client sees only contracted modules.
- Backstage can edit and deactivate.
- Document final configuration.
