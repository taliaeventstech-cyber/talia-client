// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  hasReachedDailyNewPageLimit,
  INSTALLED_WEB_NEW_PAGES_PER_DAY,
  isArchiveListingUrl,
  isRemovedInstalledPage,
  isRetiredInstalledPage,
} from './installed-web-lifecycle'

describe('isArchiveListingUrl', () => {
  it.each([
    'https://salafenix.com/tag/teatre-familiar',
    'https://salafenix.com/etiquetes/dansa',
    'https://salafenix.com/category/noticies/',
    'https://salafenix.com/categories/musica',
    'https://salafenix.com/page/4',
    'https://salafenix.com/programacio/page/2/',
    'https://salafenix.com/search/clown',
    'https://salafenix.com/author/admin',
    'https://salafenix.com/feed',
    'https://salafenix.com/?s=flamenco',
    'https://salafenix.com/programacio?paged=3',
    'https://salafenix.com/?cat=12',
  ])('treats %s as an archive listing', (url) => {
    expect(isArchiveListingUrl(url)).toBe(true)
  })

  it.each([
    'https://salafenix.com/',
    'https://salafenix.com/programacio',
    'https://salafenix.com/programacio/helenas',
    'https://salafenix.com/qui-som',
    'https://salafenix.com/informacio-taquilles',
    'https://salafenix.com/pagina-de-contacte',
    'https://salafenix.com/tagore-recital',
    'https://salafenix.com/espectacle?lang=ca',
  ])('keeps %s as a content page', (url) => {
    expect(isArchiveListingUrl(url)).toBe(false)
  })

  it('ignores values that are not URLs', () => {
    expect(isArchiveListingUrl('not a url')).toBe(false)
  })
})

describe('isRetiredInstalledPage', () => {
  it('is retired when only operator-retired chunks remain', () => {
    expect(isRetiredInstalledPage({ activeChunks: 0, retiredChunks: 5 })).toBe(true)
  })

  it('is not retired while any chunk is still active', () => {
    expect(isRetiredInstalledPage({ activeChunks: 2, retiredChunks: 5 })).toBe(false)
  })

  it('is not retired for a page that was never indexed', () => {
    expect(isRetiredInstalledPage({ activeChunks: 0, retiredChunks: 0 })).toBe(false)
  })
})

describe('isRemovedInstalledPage', () => {
  it('keeps an operator-retired page from being ingested again', () => {
    expect(isRemovedInstalledPage('removed')).toBe(true)
    expect(isRemovedInstalledPage('ready')).toBe(false)
  })
})

describe('hasReachedDailyNewPageLimit', () => {
  it('allows new pages below the daily limit', () => {
    expect(hasReachedDailyNewPageLimit(INSTALLED_WEB_NEW_PAGES_PER_DAY - 1)).toBe(false)
  })

  it('blocks new pages at the daily limit', () => {
    expect(hasReachedDailyNewPageLimit(INSTALLED_WEB_NEW_PAGES_PER_DAY)).toBe(true)
  })
})
