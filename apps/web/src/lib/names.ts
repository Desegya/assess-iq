const TITLES = new Set(['dr', 'prof', 'professor', 'mr', 'mrs', 'ms', 'miss', 'rev', 'sir', 'madam', 'engr', 'arc', 'barr'])

/** "Dr Ama Mensah" → "Dr Mensah"; "Ama Mensah" → "Ama". Lecturers are usually addressed by title and surname. */
export function greetingName(name: string | undefined, fallback: string): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length === 0) return fallback
  const first = parts[0]!
  if (TITLES.has(first.replace(/\.$/, '').toLowerCase()) && parts.length > 1) return `${first} ${parts[parts.length - 1]}`
  return first
}
