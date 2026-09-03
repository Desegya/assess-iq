import { getSubjectColor } from '@/lib/subject-color'

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')

  const color = getSubjectColor(name)

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-heading font-bold bg-gradient-to-br ${color.gradient} flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={name}
    >
      {initials || '?'}
    </span>
  )
}
