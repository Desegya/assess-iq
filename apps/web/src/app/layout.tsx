import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Providers } from '@/components/providers'
import { ProductTheme } from '@/components/product/ProductTheme'
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
  title: {
    template: '%s | KwikEval',
    default: 'KwikEval — Quick, fair tests for your class',
  },
  description:
    'KwikEval helps lecturers set tests from their own notes or question papers, share one class link, and see results the moment students finish.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased bg-[#fcfbfe]">
        <Providers>
          <ProductTheme>{children}</ProductTheme>
        </Providers>
      </body>
    </html>
  )
}
