import type { NextConfig } from 'next'

// The API address is baked into the browser bundle at build time. Without it the site
// silently calls http://localhost:3001 and nobody can sign in, so hosted builds must set it.
if (process.env.VERCEL && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is not set for this Vercel build. Set it to the API base URL, e.g. ' +
      'https://assessiq-api-production.up.railway.app/api/v1, then redeploy.',
  )
}

const nextConfig: NextConfig = {
  // Transpile local workspace packages
  transpilePackages: ['@assessiq/types'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.cloudflare.com' },
    ],
  },
}

export default nextConfig
