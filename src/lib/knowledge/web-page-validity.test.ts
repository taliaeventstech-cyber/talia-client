import { describe, expect, it } from 'vitest'
import { getWebPageRejection } from './web-page-validity'

describe('web page validity', () => {
  it.each([404, 410])('rejects HTTP %s pages', (httpStatus) => {
    expect(getWebPageRejection({ httpStatus, title: 'Cartelera' })?.code).toBe('page_not_found')
  })

  it.each([
    'Page Not Found - Sala Fènix',
    '404 | Teatre',
    'Página no encontrada',
    'Pàgina no trobada',
    'Page introuvable',
  ])('rejects a soft 404 title: %s', (title) => {
    expect(getWebPageRejection({ httpStatus: 200, title })?.code).toBe('page_not_found')
  })

  it('does not reject valid titles containing ordinary page numbers', () => {
    expect(getWebPageRejection({ httpStatus: 200, title: 'Històric d’espectacles - pàgina 404' })).toBeNull()
  })
})
