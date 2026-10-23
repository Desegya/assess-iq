import type { Metadata } from 'next'
import { SITE_URL, SITE_DESCRIPTION } from '@/lib/seo'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Providers } from '@/components/providers'
import 'katex/dist/katex.min.css'
import '../styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'Nightklass',
  robots: { index: false, follow: true },
  title: {
    template: '%s | Nightklass',
    default: 'Nightklass — AI Study Planner & Personal Study Coach',
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'Nightklass',
    locale: 'en_US',
    title: 'Nightklass — AI Study Planner & Personal Study Coach',
    description: SITE_DESCRIPTION,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Nightklass — Study smarter. Know exactly what to do next.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nightklass — AI Study Planner & Personal Study Coach',
    description: SITE_DESCRIPTION,
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased bg-brand-bg">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
