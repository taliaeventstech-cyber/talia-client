export type EmailProcessingFailureCode =
  | 'mailbox_not_connected'
  | 'inbound_message_not_found'
  | 'message_without_readable_content'
  | 'talia_ai_unavailable'
  | 'provider_draft_failed'
  | 'processing_failed'

export function getEmailProcessingFailureCode(error: string): EmailProcessingFailureCode {
  if (error === 'No connected email mailbox for this tenant') return 'mailbox_not_connected'
  if (error === 'No inbound email message found to process') return 'inbound_message_not_found'
  if (error === 'Inbound email has no text body to process') return 'message_without_readable_content'
  if (error.startsWith('TALIA AI')) return 'talia_ai_unavailable'
  if (error === 'Failed to create provider draft' || error === 'Failed to refresh email connection') return 'provider_draft_failed'
  return 'processing_failed'
}
