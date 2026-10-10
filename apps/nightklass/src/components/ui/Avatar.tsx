
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')


  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-[#7545cf] font-medium bg-[#eee5fc] flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={name}
    >
      {initials || '?'}
    </span>
  )
}
