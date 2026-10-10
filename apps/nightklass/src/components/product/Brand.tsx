import Image from 'next/image'
export function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5 text-base font-semibold tracking-tight text-[#241f2e]">
      <Image src="/landing/nightklass-logo.svg" width={32} height={32} alt="" />
      NightKlass
    </span>
  )
}
