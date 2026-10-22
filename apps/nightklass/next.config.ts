import type { NextConfig } from 'next'

const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').origin
  } catch {
    return ''
  }
})()
const dev = process.env.NODE_ENV !== 'production'

// Next.js App Router injects inline bootstrap scripts, so script-src needs
// 'unsafe-inline' unless every page becomes dynamic for nonces. The policy
// still blocks third-party scripts, plugins, framing and — most importantly
// for stolen-session risk — connections to any origin other than the API.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // YouTube thumbnails for recommended videos; data: for inline icons.
  "img-src 'self' data: blob: https://i.ytimg.com",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}${dev ? ' ws: http://localhost:* http://127.0.0.1:*' : ''}`,
  // Downloads open short-lived signed storage links in a new tab.
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  transpilePackages: ['@assessiq/types'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
        ],
      },
    ]
  },
}

export default nextConfig
