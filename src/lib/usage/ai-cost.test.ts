import { describe, expect, it } from 'vitest'
import { calculateAiCostUsdMicros } from './ai-cost'

const pricing = {
  id: 'pricing-id',
  provider: 'openai',
  model: 'gpt-4o-mini',
  currency: 'USD',
  input_usd_micros_per_million: 150_000,
  cached_input_usd_micros_per_million: 75_000,
  output_usd_micros_per_million: 600_000,
  effective_from: '2026-07-16T00:00:00.000Z',
  effective_to: null,
  source_url: 'https://developers.openai.com/api/docs/pricing',
  created_at: '2026-07-16T00:00:00.000Z',
}

describe('AI cost accounting', () => {
  it('prices uncached input, cached input and output independently in USD micros', () => {
    expect(calculateAiCostUsdMicros({
      component: 'answer_agent',
      provider: 'openai',
      model: 'gpt-4o-mini',
      request_count: 1,
      input_tokens: 1_000_000,
      cached_input_tokens: 400_000,
      output_tokens: 100_000,
    }, pricing)).toBe(180_000)
  })

  it('retains sub-micro costs instead of rounding every request to a cent', () => {
    expect(calculateAiCostUsdMicros({
      component: 'retrieval_embedding',
      provider: 'openai',
      model: 'text-embedding-3-small',
      request_count: 1,
      input_tokens: 7,
      cached_input_tokens: 0,
      output_tokens: 0,
    }, { ...pricing, model: 'text-embedding-3-small', input_usd_micros_per_million: 20_000 })).toBe(0.14)
  })
})
