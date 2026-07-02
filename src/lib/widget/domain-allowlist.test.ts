// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest'
import { getAuthorizedWidgetHosts, normalizeAllowedWidgetDomains, validateWidgetRequestDomain } from './domain-allowlist'

describe('widget domain allowlist', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('allows widget requests from the tenant website domain', () => {
    const result = validateWidgetRequestDomain({
      request: new Request('https://agora.talia.events/api/chat/tenant-1', {
        headers: { origin: 'https://talia.events' },
      }),
      pageUrl: 'https://talia.events/pricing',
      websiteUrl: 'https://talia.events',
      widgetConfig: {},
    })

    expect(result.ok).toBe(true)
  })

  it('blocks a copied script that fakes page_url from an unauthorized origin', () => {
    const result = validateWidgetRequestDomain({
      request: new Request('https://agora.talia.events/api/chat/tenant-1', {
        headers: { origin: 'https://attacker.example' },
      }),
      pageUrl: 'https://talia.events/pricing',
      websiteUrl: 'https://talia.events',
      widgetConfig: {},
    })

    expect(result).toMatchObject({
      ok: false,
      error: 'domain_not_allowed',
      requestHost: 'attacker.example',
      pageHost: 'talia.events',
    })
  })

  it('does not trust page_url without an observed browser origin by default', () => {
    const result = validateWidgetRequestDomain({
      request: new Request('https://agora.talia.events/api/chat/tenant-1'),
      pageUrl: 'https://talia.events/pricing',
      websiteUrl: 'https://talia.events',
      widgetConfig: {},
    })

    expect(result).toMatchObject({
      ok: false,
      error: 'domain_not_allowed',
      requestHost: null,
      pageHost: 'talia.events',
    })
  })

  it('supports extra authorized domains stored in widget_config', () => {
    const result = validateWidgetRequestDomain({
      request: new Request('https://agora.talia.events/api/chat/tenant-1', {
        headers: { origin: 'https://preview.example.com' },
      }),
      pageUrl: 'https://preview.example.com/pricing',
      websiteUrl: 'https://talia.events',
      widgetConfig: {
        allowedDomains: ['preview.example.com'],
      },
    })

    expect(result.ok).toBe(true)
  })

  it('allows the Agora API origin for internal previews', () => {
    const result = validateWidgetRequestDomain({
      request: new Request('https://agora.talia.events/api/widget/tenant-1', {
        headers: { referer: 'https://agora.talia.events/olympia.html' },
      }),
      pageUrl: 'https://talia.events/olympia.html',
      websiteUrl: 'https://talia.events',
      widgetConfig: {},
    })

    expect(result.ok).toBe(true)
  })

  it('normalizes www variants for the main website domain', () => {
    expect(getAuthorizedWidgetHosts({
      websiteUrl: 'https://talia.events',
      widgetConfig: {},
    })).toEqual(expect.arrayContaining(['talia.events', 'www.talia.events']))
  })

  it('normalizes operator-entered domain lists', () => {
    expect(normalizeAllowedWidgetDomains('https://preview.example.com/path\nexample.org, www.sample.org')).toEqual([
      'preview.example.com',
      'www.preview.example.com',
      'example.org',
      'www.example.org',
      'www.sample.org',
      'sample.org',
    ])
  })
})
