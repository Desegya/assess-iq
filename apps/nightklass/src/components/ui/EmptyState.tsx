import { NightIllustration } from './NightIllustration'

interface EmptyStateProps {
  illustration?: 'empty' | 'celebrate' | 'search' | 'chat'
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function EmptyState({ illustration = 'empty', title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="card p-10 text-center animate-fade-in">
      <div className="flex justify-center mb-3 animate-pop">
        <NightIllustration variant={illustration} />
      </div>
      <p className="text-slate-700 font-semibold">{title}</p>
      {subtitle && <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">{subtitle}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
