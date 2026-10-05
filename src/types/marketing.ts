import { z } from 'zod'

export const metaMarketingConnectionSummarySchema = z.object({
  id: z.uuid(),
  status: z.enum(['connected', 'error', 'revoked', 'disabled']),
  business_id: z.string().min(1),
  business_name: z.string().min(1).nullable(),
  ad_account_id: z.string().min(1),
  ad_account_name: z.string().min(1).nullable(),
  ad_account_currency: z.string().length(3).nullable(),
  rollout_enabled: z.boolean(),
  scopes: z.array(z.string()),
  connected_at: z.string().datetime({ offset: true }).nullable(),
  token_expires_at: z.string().datetime({ offset: true }).nullable(),
  updated_at: z.string().datetime({ offset: true }),
})

export type MetaMarketingConnectionSummary = z.infer<
  typeof metaMarketingConnectionSummarySchema
>
