import { Geist, Instrument_Serif } from 'next/font/google'
import './product.css'

const geist = Geist({ subsets: ['latin'], variable: '--product-sans', display: 'swap' })
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--product-serif', display: 'swap' })

/** Scoped to auth and protected routes; the marketing page keeps its own styles. */
export function ProductTheme({ children }: { children: React.ReactNode }) {
  return <div className={`nk-product ${geist.variable} ${serif.variable}`}>{children}</div>
}
