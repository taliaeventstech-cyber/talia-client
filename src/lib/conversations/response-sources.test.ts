import { describe, expect, it } from 'vitest'
import {
  getResponseSourceReferences,
  resolveResponseSourcesByMessageId,
} from './response-sources'

describe('response sources', () => {
  it('uses the persisted source names and keeps the presentation compact', () => {
    const result = resolveResponseSourcesByMessageId(
      new Map([['message-1', [
        { id: null, sourceId: 'source-1', sourceType: 'pdf' },
        { id: null, sourceId: 'source-2', sourceType: 'url' },
        { id: null, sourceId: 'source-3', sourceType: 'manual' },
        { id: null, sourceId: 'source-4', sourceType: 'url' },
      ]]]),
      [],
      [
        { id: 'source-1', name: 'Programación septiembre.pdf', type: 'pdf' },
        { id: 'source-2', name: 'Web oficial', type: 'url' },
        { id: 'source-3', name: 'Preguntas frecuentes', type: 'manual' },
        { id: 'source-4', name: 'Página de accesibilidad', type: 'url' },
      ],
    )

    expect(result.get('message-1')).toEqual({
      sources: [
        { label: 'Programación septiembre.pdf', href: 'files' },
        { label: 'Web oficial', href: 'installed' },
        { label: 'Preguntas frecuentes', href: 'faqs' },
      ],
      additionalCount: 1,
    })
  })

  it('falls back to a human-readable FAQ when a manual answer has no source row', () => {
    const result = resolveResponseSourcesByMessageId(
      new Map([['message-1', [{ id: 'item-1', sourceId: null, sourceType: 'manual' }]]]),
      [{ id: 'item-1', source_id: null, question: '¿Hay descuento para estudiantes?' }],
      [],
    )

    expect(result.get('message-1')).toEqual({
      sources: [{ label: 'FAQ: ¿Hay descuento para estudiantes?', href: 'faqs' }],
      additionalCount: 0,
    })
  })

  it('supports legacy web-response metadata without exposing diagnostics', () => {
    expect(getResponseSourceReferences({
      knowledge_item_id: 'item-1',
      knowledge_source_id: 'source-1',
      knowledge_source_type: 'manual',
      knowledge_score: 0.98,
    })).toEqual([{ id: 'item-1', sourceId: 'source-1', sourceType: 'manual' }])
  })

  it('keeps verified official web citations as external response sources', () => {
    const references = getResponseSourceReferences({
      agent_sources: [{
        id: 'official-web-programa',
        source_id: null,
        source_type: 'official_web_search',
        title: 'Programa oficial',
        url: 'https://artphotobcn.com/programa',
      }],
    })
    const result = resolveResponseSourcesByMessageId(new Map([['message-1', references]]), [], [])

    expect(result.get('message-1')).toEqual({
      sources: [{
        label: 'Programa oficial',
        href: 'https://artphotobcn.com/programa',
        external: true,
      }],
      additionalCount: 0,
    })
  })

  it('labels installed-widget evidence with its page, even when the old page source is gone', () => {
    const references = [{
      id: '11111111-1111-4111-8111-111111111111',
      sourceId: '22222222-2222-4222-8222-222222222222',
      sourceType: 'web_snapshot',
    }]
    const result = resolveResponseSourcesByMessageId(
      new Map([['message-1', references]]),
      [],
      [],
      new Map([['11111111-1111-4111-8111-111111111111', { title: 'Helenas - Sala Fènix', url: 'https://salafenix.com/programacio/helenas' }]]),
    )

    expect(result.get('message-1')?.sources).toEqual([{ label: 'Helenas - Sala Fènix', href: 'installed' }])
  })

  it('falls back to the page path when the captured page has no title', () => {
    const result = resolveResponseSourcesByMessageId(
      new Map([['message-1', [{ id: '33333333-3333-4333-8333-333333333333', sourceId: null, sourceType: 'web_snapshot' }]]]),
      [],
      [],
      new Map([['33333333-3333-4333-8333-333333333333', { title: null, url: 'https://www.salafenix.com/contacte' }]]),
    )

    expect(result.get('message-1')?.sources).toEqual([{ label: 'salafenix.com/contacte', href: 'installed' }])
  })
})
