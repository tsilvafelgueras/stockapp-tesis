'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { quitarPartidaDePedido } from '../actions'

export default function QuitarPartidaButton({
  pedidoId,
  pedidoPartidaId,
  lote,
  asignados,
}: {
  pedidoId: string
  pedidoPartidaId: string
  lote: string | null
  asignados: number
}) {
  const router = useRouter()
  const [confirmar, setConfirmar] = useState(false)
  const [pending, startTransition] = useTransition()

  function ejecutar() {
    startTransition(async () => {
      const res = await quitarPartidaDePedido({ pedidoId, pedidoPartidaId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const liberados = res.rollosLiberados
      toast.success(
        liberados > 0
          ? `Línea quitada. ${liberados} ${
              liberados === 1 ? 'rollo vuelve' : 'rollos vuelven'
            } a stock como "Sin ubicar".`
          : 'Línea quitada del pedido.'
      )
      setConfirmar(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmar(true)}
        className="rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/5"
      >
        Quitar
      </button>

      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Quitar línea del pedido
              </p>
              <p className="mt-1 text-sm">
                Se quita la partida{' '}
                <strong className="font-mono">{lote ?? '-'}</strong> del pedido.
                {asignados > 0 ? (
                  <>
                    {' '}
                    Los <strong>{asignados}</strong>{' '}
                    {asignados === 1 ? 'rollo pickeado vuelve' : 'rollos pickeados vuelven'}{' '}
                    a stock como &ldquo;Sin ubicar&rdquo; y el depósito recibe un
                    aviso para reubicarlos.
                  </>
                ) : (
                  ' No hay rollos pickeados todavía.'
                )}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmar(false)}
                disabled={pending}
                className="flex-1 rounded-md border px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutar}
                disabled={pending}
                className="flex-1 rounded-md bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {pending ? 'Quitando...' : 'Quitar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
