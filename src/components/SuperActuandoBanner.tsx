'use client'

import { useTransition } from 'react'
import { ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { terminarImpersonacion } from '@/app/super/actions'

export default function SuperActuandoBanner({
  empresaNombre,
}: {
  empresaNombre: string | null
}) {
  const [pending, startTransition] = useTransition()

  function handleSalir() {
    startTransition(async () => {
      const res = await terminarImpersonacion()
      // terminarImpersonacion redirige a /super si todo va bien;
      // solo llegamos acá si devolvió error.
      if (res?.error) {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="flex items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <ShieldAlert className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Modo super-admin.</span>{' '}
        <span>
          Estás operando dentro de{' '}
          <span className="font-semibold">
            {empresaNombre ?? 'una empresa'}
          </span>{' '}
          como parte del equipo de Nudo Stock. Tu cuenta sigue siendo
          super-admin.
        </span>
      </p>
      <button
        type="button"
        onClick={handleSalir}
        disabled={pending}
        className="shrink-0 rounded-md border border-amber-700/30 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
      >
        {pending ? 'Saliendo…' : 'Salir y volver a /super'}
      </button>
    </div>
  )
}
