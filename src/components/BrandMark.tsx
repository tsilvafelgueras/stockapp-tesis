import Image from 'next/image'

export default function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ${className}`}
    >
      <Image
        src="/nudo-logo.svg"
        alt="NUDO"
        width={56}
        height={70}
        className="h-full w-full object-cover"
        priority
      />
    </span>
  )
}
