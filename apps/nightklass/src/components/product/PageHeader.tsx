import { Icon, type IconName } from './Icon'
export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  action,
}: {
  title: string
  description?: string
  eyebrow?: string
  icon?: IconName
  action?: React.ReactNode
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && (
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[.12em] text-violet-700">
            {icon && <Icon name={icon} className="h-4 w-4" />}
            {eyebrow}
          </p>
        )}
        <h1>{title}</h1>
        {description && (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500">{description}</p>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  )
}
