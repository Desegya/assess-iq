import { StudyArtwork } from '@/components/product/StudyArtwork'

interface EmptyStateProps {
  illustration?: 'empty' | 'celebrate' | 'search' | 'chat'
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function EmptyState({ illustration = 'empty', title, subtitle, action }: EmptyStateProps) {
  const variant =
    illustration === 'celebrate' ? 'success' : illustration === 'empty' ? 'course' : illustration
  return (
    <div className="rounded-[24px] border border-dashed border-[#dfd4ee] bg-[#faf7ff] px-5 py-10 text-center sm:px-10 sm:py-12">
      <div className="mb-5 flex justify-center">
        <StudyArtwork variant={variant} />
      </div>
      <h2 className="product-display !text-[32px] text-[#30253e]">{title}</h2>
      {subtitle && (
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#716778]">{subtitle}</p>
      )}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}
