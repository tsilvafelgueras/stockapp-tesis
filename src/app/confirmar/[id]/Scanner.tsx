'use client'

import { useCallback, useMemo, useState } from 'react'
import { type CodeScannerResult } from '@/components/CodeScanner'
import ScannerByReaderType, {
  type ReaderType,
} from '@/components/ScannerByReaderType'
import { extraerCodigoRollo, type PatronCodigo } from '@/lib/scanner'
import { confirmarRollo } from './actions'

type Rollo = { id: string; numero_pieza: string; estado: string }

type Props = {
  ingresoId: string
  rollos: Rollo[]
  totalDeclarado: number | null
  patrones: PatronCodigo[]
  readerType: ReaderType
}

type Mensaje = {
  texto: string
  tipo: 'error' | 'success' | 'warning'
}

export default function Scanner({
  ingresoId,
  rollos,
  totalDeclarado,
  patrones,
  readerType,
}: Props) {
  const [rollosLocales, setRollosLocales] = useState<Rollo[]>(rollos)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [ubicacion, setUbicacion] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)
  const [mostrarPendientes, setMostrarPendientes] = useState(false)

  const pendientes = rollosLocales.filter((r) => r.estado === 'pendiente')
  const confirmados = rollosLocales.filter((r) => r.estado !== 'pendiente').length
  const total = rollosLocales.length
  const progresoPct = total > 0 ? Math.round((confirmados / total) * 100) : 0
  const completo = pendientes.length === 0
  const codigosRollos = useMemo(
    () => rollosLocales.map((r) => r.numero_pieza),
    [rollosLocales]
  )

  const mostrarMensaje = useCallback((texto: string, tipo: Mensaje['tipo']) => {
    setMensaje({ texto, tipo })
    setTimeout(() => setMensaje(null), 4000)
  }, [])

  const handleLectura = useCallback(
    (result: CodeScannerResult) => {
      const extraido = extraerCodigoRollo(result.texto, patrones, codigosRollos)
      if (!extraido.ok) {
        mostrarMensaje(
          'No reconocimos el código. Probá de nuevo o ingresalo manualmente.',
          'error'
        )
        return
      }
      setPendingCode(extraido.codigo)
    },
    [codigosRollos, patrones, mostrarMensaje]
  )

  function cancelarModal() {
    setPendingCode(null)
    setUbicacion('')
  }

  async function handleConfirmar(textoEscaneado: string) {
    setConfirmando(true)
    const result = await confirmarRollo(ingresoId, textoEscaneado, ubicacion)
    setConfirmando(false)

    if (!result.ok) {
      mostrarMensaje(
        result.error,
        result.codigo === 'YA_CONFIRMADO' ? 'warning' : 'error'
      )
      setPendingCode(null)
      setUbicacion('')
      return
    }

    setRollosLocales((prev) =>
      prev.map((r) =>
        r.numero_pieza === result.rollo.numero_pieza
          ? { ...r, estado: 'en_stock' }
          : r
      )
    )
    setPendingCode(null)
    setUbicacion('')

    if (result.ingresoCompleto) {
      mostrarMensaje('¡Todos los rollos confirmados! Ingreso cerrado.', 'success')
      return
    }

    mostrarMensaje(`Rollo ${result.rollo.numero_pieza} confirmado.`, 'success')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {confirmados} de {total} rollos confirmados
          </span>
          {totalDeclarado && totalDeclarado !== total && (
            <span className="text-xs text-warning">
              Planilla declara {totalDeclarado}
            </span>
          )}
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
            {mostrarPendientes ? 'Ocultar' : 'Ver'} pendientes ({pendientes.length})
          </button>
        )}

        {mostrarPendientes && pendientes.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {pendientes.map((r) => (
              <span
                key={r.id}
                className="rounded bg-warning/10 px-1.5 py-0.5 font-mono text-[11px] text-warning"
              >
                {r.numero_pieza}
              </span>
            ))}
          </div>
        )}
      </div>

      {mensaje && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            mensaje.tipo === 'success'
              ? 'border border-success/30 bg-success/10 text-success'
              : mensaje.tipo === 'warning'
                ? 'border border-warning/30 bg-warning/10 text-warning'
                : 'border border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {completo ? (
        <div className="rounded-lg border border-success/30 bg-success/10 p-5 text-center text-sm text-success">
          Todos los rollos de este ingreso ya fueron confirmados.
        </div>
      ) : (
        <ScannerByReaderType
          readerType={readerType}
          onRead={handleLectura}
          paused={Boolean(pendingCode) || confirmando}
          title={
            readerType === 'qr'
              ? 'Escanear código QR'
              : readerType === 'barcode'
                ? 'Escanear código de barras'
                : 'Escanear QR o código de barras'
          }
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

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Ubicación{' '}
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </label>
              <input
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej: A42"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />
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
                onClick={() => handleConfirmar(pendingCode)}
                disabled={confirmando}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {confirmando ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
