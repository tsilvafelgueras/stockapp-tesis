'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import CodeScanner, { type CodeScannerResult } from '@/components/CodeScanner'
import { extraerCodigoRollo } from '@/lib/scanner'
import { pickearRollo } from './actions'

export type PickRollo = {
  pedido_rollo_id: string
  pickeado_at: string | null
  rollo_id: string
  numero_pieza: string
  ubicacion: string | null
  kilos: number | null
  articulo: string | null
  color: string | null
}

export default function PickingScanner({
  pedidoId,
  items,
}: {
  pedidoId: string
  items: PickRollo[]
}) {
  const router = useRouter()
  const [itemsLocales, setItemsLocales] = useState<PickRollo[]>(items)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [mostrarPendientes, setMostrarPendientes] = useState(true)

  const pendientes = itemsLocales.filter((r) => r.pickeado_at == null)
  const pickeados = itemsLocales.length - pendientes.length
  const total = itemsLocales.length
  const progresoPct = total > 0 ? Math.round((pickeados / total) * 100) : 0
  const completo = pendientes.length === 0
  const codigosRollos = useMemo(
    () => itemsLocales.map((r) => r.numero_pieza),
    [itemsLocales]
  )

  const handleLectura = useCallback((result: CodeScannerResult) => {
    setPendingCode(extraerCodigoRollo(result.texto, codigosRollos))
  }, [codigosRollos])

  function cancelarModal() {
    setPendingCode(null)
  }

  async function ejecutarPickeo(textoEscaneado: string) {
    setConfirmando(true)
    const res = await pickearRollo(pedidoId, textoEscaneado)
    setConfirmando(false)

    if (!res.ok) {
      setPendingCode(null)
      if (res.error.includes('ya fue pickeado')) {
        toast.warning(res.error)
      } else {
        toast.error(res.error)
      }
      return
    }

    setItemsLocales((prev) =>
      prev.map((r) =>
        r.numero_pieza === res.numeroPieza
          ? { ...r, pickeado_at: new Date().toISOString() }
          : r
      )
    )
    setPendingCode(null)

    if (res.pedidoCompleto) {
      toast.success('¡Picking completo! El pedido pasa a "Lista".')
      setTimeout(() => router.refresh(), 1500)
      return
    }

    toast.success(
      `Pieza ${res.numeroPieza} pickeada (${res.total - res.pendientes}/${res.total}).`
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {pickeados} de {total} rollos pickeados
          </span>
          <span className="text-xs text-muted-foreground">{progresoPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-100">
          <div
            className="h-2 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progresoPct}%` }}
          />
        </div>

        {pendientes.length > 0 && (
          <button
            type="button"
            onClick={() => setMostrarPendientes((v) => !v)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {mostrarPendientes ? 'Ocultar' : 'Ver'} pendientes (
            {pendientes.length})
          </button>
        )}

        {mostrarPendientes && pendientes.length > 0 && (
          <ul className="space-y-1 pt-1 text-xs">
            {pendientes.map((r) => (
              <li
                key={r.pedido_rollo_id}
                className="flex items-center justify-between gap-3 rounded bg-warning/5 px-2 py-1"
              >
                <span className="font-mono">{r.numero_pieza}</span>
                <span className="text-muted-foreground">
                  {r.articulo ?? '—'}
                  {r.color ? ` · ${r.color}` : ''}
                  {r.ubicacion ? ` · ${r.ubicacion}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {completo ? (
        <div className="space-y-2 rounded-lg border border-success/30 bg-success/10 p-5 text-center">
          <p className="text-2xl">✓</p>
          <p className="font-semibold text-success">Picking completo</p>
          <p className="text-sm text-muted-foreground">
            El pedido pasa a estado &ldquo;Lista&rdquo; y queda esperando
            despacho.
          </p>
        </div>
      ) : (
        <CodeScanner
          onRead={handleLectura}
          paused={Boolean(pendingCode) || confirmando}
          title="Escanear QR o código de barras"
          manualLabel="Ingresar código manualmente"
          manualPlaceholder="Ej: 204021911"
        />
      )}

      {pendingCode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Código detectado
              </p>
              <p className="mt-0.5 break-all font-mono text-lg font-bold">
                {pendingCode}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelarModal}
                disabled={confirmando}
                className="flex-1 rounded-md border px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => ejecutarPickeo(pendingCode)}
                disabled={confirmando}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {confirmando ? 'Pickeando...' : 'Pickear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
