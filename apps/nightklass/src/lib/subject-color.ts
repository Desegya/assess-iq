export interface SubjectColor {
  name: string
  text: string
  bg: string
  bgSoft: string
  border: string
  ring: string
  gradient: string
  hex: string
}

const PALETTE: SubjectColor[] = [
  {
    name: 'blue',
    text: 'text-blue-600',
    bg: 'bg-blue-500',
    bgSoft: 'bg-blue-100',
    border: 'border-blue-200',
    ring: 'ring-blue-500/20',
    gradient: 'from-blue-500 to-indigo-600',
    hex: '#3b82f6',
  },
  {
    name: 'orange',
    text: 'text-orange-600',
    bg: 'bg-orange-500',
    bgSoft: 'bg-orange-100',
    border: 'border-orange-200',
    ring: 'ring-orange-500/20',
    gradient: 'from-orange-400 to-red-500',
    hex: '#f97316',
  },
  {
    name: 'lime',
    text: 'text-lime-600',
    bg: 'bg-lime-500',
    bgSoft: 'bg-lime-100',
    border: 'border-lime-200',
    ring: 'ring-lime-500/20',
    gradient: 'from-lime-400 to-emerald-500',
    hex: '#84cc16',
  },
  {
    name: 'cyan',
    text: 'text-cyan-600',
    bg: 'bg-cyan-500',
    bgSoft: 'bg-cyan-100',
    border: 'border-cyan-200',
    ring: 'ring-cyan-500/20',
    gradient: 'from-cyan-400 to-blue-500',
    hex: '#06b6d4',
  },
  {
    name: 'amber',
    text: 'text-amber-600',
    bg: 'bg-amber-500',
    bgSoft: 'bg-amber-100',
    border: 'border-amber-200',
    ring: 'ring-amber-500/20',
    gradient: 'from-amber-400 to-orange-500',
    hex: '#f59e0b',
  },
  {
    name: 'teal',
    text: 'text-teal-600',
    bg: 'bg-teal-500',
    bgSoft: 'bg-teal-100',
    border: 'border-teal-200',
    ring: 'ring-teal-500/20',
    gradient: 'from-teal-500 to-cyan-600',
    hex: '#14b8a6',
  },
]

/** Deterministically maps a seed (e.g. course id or title) to one of a fixed set of bold, gender-neutral accent hues. */
export function getSubjectColor(seed: string): SubjectColor {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % PALETTE.length
  return PALETTE[index]!
}
