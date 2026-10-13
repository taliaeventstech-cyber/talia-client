import type { NextConfig } from 'next'
import { buildContentSecurityPolicy } from './src/lib/security/content-security-policy'
import { PRIVATE_NO_STORE_HEADERS } from './src/lib/security/cache-control'

const isProduction = process.env.NODE_ENV === 'production'
const contentSecurityPolicy = buildContentSecurityPolicy({
  isDevelopment: !isProduction,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  splineSceneUrl: process.env.NEXT_PUBLIC_AUTH_SPLINE_SCENE_URL,
})

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy,
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  ...(isProduction
    ? [{
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    }]
    : []),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/auth/:path*',
        headers: [...PRIVATE_NO_STORE_HEADERS],
      },
      {
        source: '/:widget(widget|accessibility-widget).js',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=300',
          },
        ],
      },
    ]
  },
}

export default nextConfig
