import type { Metadata } from 'next'
import { ProductTheme } from '@/components/product/ProductTheme'
export const metadata: Metadata = { title: 'Administration', robots: { index: false, follow: false } }
export default function AdminLayout({ children }: { children: React.ReactNode }) { return <ProductTheme>{children}</ProductTheme> }
