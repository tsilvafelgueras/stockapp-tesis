'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { marcarTodasLeidas } from './actions'

export default function MarcarTodasButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const res = await marcarTodasLeidas()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Marcadas como leídas.')
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-action/40 px-3 py-2 text-sm font-medium text-action transition-colors hover:bg-action/5 disabled:opacity-50"
    >
      <CheckCheck className="size-4" />
      {pending ? 'Marcando…' : 'Marcar todas leídas'}
    </button>
  )
}
