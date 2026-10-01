import { z } from 'zod'

const idSchema = z.uuid()

export function resolveInstagramActionConversationId(
  boundConversationId: string,
  formData: FormData,
): string {
  const submittedConversationId = idSchema.safeParse(formData.get('conversationId'))

  return submittedConversationId.success
    ? submittedConversationId.data
    : boundConversationId
}
