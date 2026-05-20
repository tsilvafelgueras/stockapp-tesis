import Image from 'next/image'

export default function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-action/70 bg-sidebar shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_8px_24px_rgba(0,0,0,0.18)] ${className}`}
    >
      <Image
        src="/nudo-logo.svg"
        alt="NUDO"
        width={56}
        height={70}
        className="h-full w-full scale-[1.04] object-cover"
        priority
      />
    </span>
  )
}
