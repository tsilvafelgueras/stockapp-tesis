'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import { pickearRollo } from './actions'
import { extraerCodigoRollo } from '@/lib/scanner'

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
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const procesandoRef = useRef(false)

  const [permiso, setPermiso] = useState<
    'solicitando' | 'concedido' | 'denegado'
  >('solicitando')
  const [itemsLocales, setItemsLocales] = useState<PickRollo[]>(items)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [modoManual, setModoManual] = useState(false)
  const [codigoManual, setCodigoManual] = useState('')
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

  const iniciarScanner = useCallback(async () => {
    if (!videoRef.current) return
    try {
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error) => {
          if (result && !procesandoRef.current && !pendingCode) {
            procesandoRef.current = true
            setPendingCode(extraerCodigoRollo(result.getText(), codigosRollos))
          }
          if (error && !(error instanceof NotFoundException)) {
            console.warn('Scanner error:', error)
          }
        }
      )
      controlsRef.current = controls
      setPermiso('concedido')
    } catch (e) {
      const msg = (e as Error).message ?? ''
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setPermiso('denegado')
      } else {
        setPermiso('denegado')
        console.error('Scanner init error:', e)
      }
    }
  }, [pendingCode, codigosRollos])

  useEffect(() => {
    if (!modoManual && !completo) {
      iniciarScanner()
    }
    return () => {
      controlsRef.current?.stop()
    }
  }, [modoManual, completo]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingCode) {
      controlsRef.current?.stop()
    }
  }, [pendingCode])

  function cancelarModal() {
    setPendingCode(null)
    procesandoRef.current = false
    iniciarScanner()
  }

  async function ejecutarPickeo(numeroPieza: string) {
    setConfirmando(true)
    const res = await pickearRollo(pedidoId, numeroPieza)
    setConfirmando(false)

    if (!res.ok) {
      if (res.error.includes('ya fue pickeado')) {
        toast.warning(res.error)
      } else {
        toast.error(res.error)
      }
      return false
    }

    setItemsLocales((prev) =>
      prev.map((r) =>
        r.numero_pieza === res.numeroPieza
          ? { ...r, pickeado_at: new Date().toISOString() }
          : r
      )
    )

    if (res.pedidoCompleto) {
      toast.success('¡Picking completo! El pedido pasa a "Lista".')
      // Refrescar para que el server vea el nuevo estado del pedido.
      setTimeout(() => router.refresh(), 1500)
      return true
    }

    toast.success(
      `Pieza ${res.numeroPieza} pickeada (${res.total - res.pendientes}/${res.total}).`
    )
    return true
  }

  async function handleConfirmarScan(numeroPieza: string) {
    const ok = await ejecutarPickeo(numeroPieza)
    setPendingCode(null)
    procesandoRef.current = false
    if (ok && !completo) iniciarScanner()
    else if (!ok) iniciarScanner()
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault()
    const codigo = extraerCodigoRollo(codigoManual, codigosRollos)
    if (!codigo) return
    const ok = await ejecutarPickeo(codigo)
    if (ok) setCodigoManual('')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de progreso */}
      <div className="rounded-lg border bg-white p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {pickeados} de {total} rollos pickeados
          </span>
          <span className="text-muted-foreground text-xs">{progresoPct}%</span>
        </div>
        <div className="w-full bg-zinc-100 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${progresoPct}%` }}
          />
        </div>

        {pendientes.length > 0 && (
          <button
            type="button"
            onClick={() => setMostrarPendientes((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
                className="flex items-center justify-between gap-3 px-2 py-1 bg-warning/5 rounded"
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
        <div className="rounded-lg border bg-success/10 border-success/30 p-5 text-center space-y-2">
          <p className="text-2xl">✓</p>
          <p className="font-semibold text-success">Picking completo</p>
          <p className="text-sm text-muted-foreground">
            El pedido pasa a estado &ldquo;Lista&rdquo; y queda esperando
            despacho.
          </p>
        </div>
      ) : (
        <>
          {/* Toggle scanner / manual */}
          <div className="flex rounded-lg border bg-white overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setModoManual(false)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                !modoManual
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-zinc-50'
              }`}
            >
              Escanear QR
            </button>
            <button
              type="button"
              onClick={() => {
                controlsRef.current?.stop()
                setModoManual(true)
                setPendingCode(null)
                procesandoRef.current = false
              }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                modoManual
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-zinc-50'
              }`}
            >
              Ingresar a mano
            </button>
          </div>

          {/* Modo manual */}
          {modoManual && (
            <form
              onSubmit={handleManual}
              className="rounded-lg border bg-white p-4 shadow-sm space-y-3"
            >
              <h3 className="font-medium text-sm">Pickear rollo a mano</h3>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Número de pieza *
                </label>
                <input
                  value={codigoManual}
                  onChange={(e) => setCodigoManual(e.target.value)}
                  required
                  placeholder="Ej: 204021911"
                  inputMode="numeric"
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={confirmando || !codigoManual.trim()}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {confirmando ? 'Pickeando…' : 'Pickear rollo'}
              </button>
            </form>
          )}

          {/* Modo scanner */}
          {!modoManual && (
            <div className="rounded-lg border bg-black overflow-hidden shadow-sm relative">
              {permiso === 'denegado' ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-white px-6 text-center">
                  <p className="font-medium">Sin acceso a la cámara</p>
                  <p className="text-sm text-zinc-400">
                    Permití el acceso desde el navegador o usá el modo
                    manual.
                  </p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    className="w-full aspect-[4/3] object-cover"
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 relative">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br" />
                    </div>
                  </div>
                  {permiso === 'solicitando' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <p className="text-white text-sm">Iniciando cámara…</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal de confirmación cuando se detecta un código */}
      {pendingCode && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm space-y-4 p-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Código detectado
              </p>
              <p className="font-mono text-lg font-bold mt-0.5">
                {pendingCode}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelarModal}
                disabled={confirmando}
                className="flex-1 rounded-md border px-4 py-2.5 text-sm hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmarScan(pendingCode)}
                disabled={confirmando}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {confirmando ? 'Pickeando…' : 'Pickear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
