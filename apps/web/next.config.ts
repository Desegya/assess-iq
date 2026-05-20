import type { NextConfig } from 'next'

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
