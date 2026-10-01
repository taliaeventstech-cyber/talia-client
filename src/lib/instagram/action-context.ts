import { z } from 'zod'

const actionContextSchema = z.object({
  tenantId: z.uuid(),
  conversationId: z.uuid(),
  locale: z.string().trim().min(1).max(10),
})

export function parseInstagramActionContext(formData: FormData) {
  return actionContextSchema.safeParse({
    tenantId: formData.get('tenantId'),
    conversationId: formData.get('conversationId'),
    locale: formData.get('locale'),
  })
}
