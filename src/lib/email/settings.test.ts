// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { getEmailAgentSettings, normalizeEmailAgentSettings } from './settings'

describe('email agent settings', () => {
  it('uses safe defaults when metadata has no channel settings', () => {
    expect(getEmailAgentSettings({})).toMatchObject({
      tone: 'professional_cercano',
      draftStyle: 'breve',
      humanReviewTopics: ['devoluciones', 'quejas', 'grupos'],
      classificationTopics: [
        'entradas',
        'horarios',
        'ubicacion',
        'accesibilidad',
        'programacion',
        'grupos',
        'devoluciones',
        'partnerships',
        'prensa',
        'quejas',
        'facturacion',
        'otro',
      ],
      signature: null,
      channelPrompt: null,
      classificationRules: null,
    })
  })

  it('normalizes channel settings from metadata', () => {
    expect(getEmailAgentSettings({
      email_agent_settings: {
        tone: 'formal',
        draft_style: 'detallado',
        signature: ' Equipo de atención ',
        channel_prompt: ' Redactar siempre con saludo breve. ',
        classification_topics: [' Entradas ', 'Facturación', 'Partnerships', 'Entradas'],
        human_review_topics: [' Prensa ', 'Quejas'],
        classification_rules: 'Escalar prensa.',
      },
    })).toMatchObject({
      tone: 'formal',
      draftStyle: 'detallado',
      signature: 'Equipo de atención',
      channelPrompt: 'Redactar siempre con saludo breve.',
      classificationTopics: ['entradas', 'facturacion', 'partnerships', 'otro'],
      humanReviewTopics: ['prensa', 'quejas'],
      classificationRules: 'Escalar prensa.',
    })
  })

  it('falls back from unsupported values', () => {
    expect(normalizeEmailAgentSettings({
      tone: 'casual',
      draftStyle: 'largo',
      classificationTopics: [],
      humanReviewTopics: [],
    })).toMatchObject({
      tone: 'professional_cercano',
      draftStyle: 'breve',
      classificationTopics: [
        'entradas',
        'horarios',
        'ubicacion',
        'accesibilidad',
        'programacion',
        'grupos',
        'devoluciones',
        'partnerships',
        'prensa',
        'quejas',
        'facturacion',
        'otro',
      ],
      humanReviewTopics: ['devoluciones', 'quejas', 'grupos'],
    })
  })
})
