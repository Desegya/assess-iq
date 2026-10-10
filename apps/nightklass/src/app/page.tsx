import type { Metadata } from 'next'
import LandingPage from '@/components/landing/LandingPage'
import { SITE_URL, SITE_DESCRIPTION } from '@/lib/seo'

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Nightklass',
    title: 'Nightklass — AI Study Planner & Personal Study Coach',
    description: SITE_DESCRIPTION,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Nightklass — Study smarter. Know exactly what to do next.' }],
  },
}

export default function HomePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Nightklass',
        url: SITE_URL,
        logo: `${SITE_URL}/landing/nightklass-logo.svg`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Nightklass',
        alternateName: 'NightKlass',
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <LandingPage />
    </>
  )
}
