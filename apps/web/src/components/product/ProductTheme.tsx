import { Geist, Instrument_Serif } from 'next/font/google'
import './product.css'

const geist = Geist({ subsets: ['latin'], variable: '--product-sans', display: 'swap' })
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--product-serif',
  display: 'swap',
})

/** The Nightklass product look (typography, purple, soft borders), shared by every KwikEval page. */
export function ProductTheme({ children }: { children: React.ReactNode }) {
  return <div className={`kwik-product ${geist.variable} ${serif.variable}`}>{children}</div>
}
