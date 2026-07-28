import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy } from './content-security-policy'

describe('buildContentSecurityPolicy', () => {
  it('restricts dangerous content and includes configured browser origins', () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: false,
      supabaseUrl: 'https://project.supabase.co/path',
      splineSceneUrl: 'https://prod.spline.design/scene/scene.splinecode',
    })

    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("frame-src 'self' https://www.google.com https://maps.google.com")
    expect(policy).toContain("base-uri 'self'")
    expect(policy).toContain('https://project.supabase.co')
    expect(policy).toContain('wss://project.supabase.co')
    expect(policy).toContain('https://prod.spline.design')
    expect(policy).not.toContain('unpkg.com')
    expect(policy).not.toContain("'unsafe-eval'")
  })

  it('allows the Next.js development evaluator only outside production', () => {
    const policy = buildContentSecurityPolicy({ isDevelopment: true })

    expect(policy).toContain("'unsafe-eval'")
  })

  it('uses a per-request nonce without allowing inline scripts', () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: false,
      nonce: 'request-nonce',
    })

    expect(policy).toContain("script-src 'self' 'nonce-request-nonce' 'strict-dynamic'")
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'")
  })

  it('does not add malformed configured origins', () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: false,
      supabaseUrl: 'not-a-url',
      splineSceneUrl: 'also-not-a-url',
    })

    expect(policy).not.toContain('not-a-url')
    expect(policy).not.toContain('also-not-a-url')
  })
})
