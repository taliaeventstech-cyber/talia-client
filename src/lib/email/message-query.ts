export const EMAIL_MESSAGE_WITH_THREAD_SELECT = `
  id,
  theatre_id,
  connection_id,
  thread_id,
  provider_message_id,
  from_email,
  from_name,
  body_text,
  body_html,
  metadata,
  received_at,
  email_threads!email_messages_thread_id_fkey!inner(
    id,
    subject,
    sender_email,
    sender_name,
    metadata
  )
`

export const EMAIL_DRAFT_WITH_THREAD_SELECT = `
  id,
  status,
  provider_draft_id,
  generated_subject,
  generated_body_text,
  error_message,
  created_at,
  updated_at,
  email_threads!email_drafts_thread_id_fkey(
    subject,
    sender_email,
    topic,
    priority,
    status
  )
`
