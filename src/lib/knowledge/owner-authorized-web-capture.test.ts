import { describe, expect, it } from 'vitest'
import {
  findFreshWidgetInstallation,
  getOwnerAuthorizedWebCapture,
  withOwnerAuthorizedWebCapture,
} from './owner-authorized-web-capture'

const now = new Date('2026-10-13T12:00:00.000Z')

describe('owner-authorized web capture', () => {
  it('accepts only a recent widget heartbeat for the source origin', () => {
    const matching = { origin: 'https://www.example.com', lastSeenAt: '2026-10-13T11:30:00.000Z' }
    expect(findFreshWidgetInstallation('https://example.com/program', [
      { origin: 'https://other.test', lastSeenAt: '2026-10-13T11:45:00.000Z' },
      { origin: 'https://example.com', lastSeenAt: '2026-10-11T11:45:00.000Z' },
      matching,
    ], now)).toEqual(matching)
  })

  it('records explicit consent without replacing unrelated source configuration', () => {
    const config = withOwnerAuthorizedWebCapture(
      { max_pages: 100, programme_extraction_enabled: true },
      {
        enabled: true,
        sourceUrl: 'https://example.com/program',
        actorUserId: 'user-1',
        installation: { origin: 'https://www.example.com', lastSeenAt: '2026-10-13T11:30:00.000Z' },
        now,
      },
    )

    expect(config).toMatchObject({ max_pages: 100, programme_extraction_enabled: true })
    expect(getOwnerAuthorizedWebCapture(config, 'https://example.com/other')).toMatchObject({
      enabled: true,
      verificationMethod: 'installed_widget',
      authorizedOrigin: 'https://www.example.com',
      authorizedBy: 'user-1',
    })
    expect(getOwnerAuthorizedWebCapture(config, 'https://other.test')).toBeNull()
  })

  it('keeps the evidence when consent is revoked', () => {
    const enabled = withOwnerAuthorizedWebCapture({}, {
      enabled: true,
      sourceUrl: 'https://example.com',
      actorUserId: 'user-1',
      installation: { origin: 'https://example.com', lastSeenAt: '2026-10-13T11:30:00.000Z' },
      now,
    })
    const revoked = withOwnerAuthorizedWebCapture(enabled, {
      enabled: false,
      sourceUrl: 'https://example.com',
      actorUserId: 'user-2',
      now: new Date('2026-10-13T13:00:00.000Z'),
    })

    expect(getOwnerAuthorizedWebCapture(revoked, 'https://example.com')).toMatchObject({
      enabled: false,
      authorizedBy: 'user-1',
      revokedBy: 'user-2',
      revokedAt: '2026-10-13T13:00:00.000Z',
    })
  })
})
