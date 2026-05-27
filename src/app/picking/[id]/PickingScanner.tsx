'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Replace } from 'lucide-react'
import { type CodeScannerResult } from '@/components/CodeScanner'
import ScannerByReaderType, {
  type ReaderType,
} from '@/components/ScannerByReaderType'
import {
  extraerCodigoCandidato,
  extraerCodigoRollo,
  type PatronCodigo,
} from '@/lib/scanner'
import { pickearRollo, reemplazarRolloEnPicking } from './actions'

export type PickRollo = {
  pedido_rollo_id: string
  pickeado_at: string | null
  rollo_id: string
  numero_pieza: string
  ubicacion: string | null
  kilos: number | null
  articulo_id: string | null
  color_id: string | null
  articulo: string | null
  color: string | null
}

export type AlternativaRollo = {
  id: string
  numero_pieza: string
  ubicacion: string | null
  kilos: number | null
  articulo_id: string
  color_id: string
  articulo_nombre: string
  color_nombre: string
}

const FALLA_CATEGORIAS: { value: string; label: string }[] = [
  { value: 'mancha', label: 'Mancha' },
  { value: 'agujero', label: 'Agujero' },
  { value: 'color_disparejo', label: 'Color disparejo' },
  { value: 'tono_diferente', label: 'Tono diferente' },
  { value: 'rotura_tejido', label: 'Rotura de tejido' },
  { value: 'otro', label: 'Otro' },
]

export default function PickingScanner({
  pedidoId,
  items,
  alternativas,
  patrones,
  readerType,
}: {
  pedidoId: string
  items: PickRollo[]
  alternativas: AlternativaRollo[]
  patrones: PatronCodigo[]
  readerType: ReaderType
}) {
  const router = useRouter()
  const [itemsLocales, setItemsLocales] = useState<PickRollo[]>(items)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [mostrarPendientes, setMostrarPendientes] = useState(true)
  const [reemplazando, setReemplazando] = useState<PickRollo | null>(null)

  const pendientes = itemsLocales.filter((r) => r.pickeado_at == null)
  const pickeados = itemsLocales.length - pendientes.length
  const total = itemsLocales.length
  const progresoPct = total > 0 ? Math.round((pickeados / total) * 100) : 0
  const completo = pendientes.length === 0
  const codigosRollos = useMemo(
    () => itemsLocales.map((r) => r.numero_pieza),
    [itemsLocales]
  )

  const ejecutarPickeo = useCallback(
    async (textoEscaneado: string) => {
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
    },
    [pedidoId, router]
  )

  const handleLectura = useCallback(
    (result: CodeScannerResult) => {
      const extraido = extraerCodigoRollo(result.texto, patrones, codigosRollos)
      if (extraido.ok) {
        setPendingCode(extraido.codigo)
        return
      }

      const candidato = extraerCodigoCandidato(result.texto, patrones)
      if (candidato) {
        void ejecutarPickeo(candidato)
        return
      }

      toast.error(
        'No reconocimos el código. Probá de nuevo o ingresalo manualmente.'
      )
    },
    [codigosRollos, patrones, ejecutarPickeo]
  )

  function cancelarModal() {
    setPendingCode(null)
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
                className="flex items-center justify-between gap-2 rounded bg-warning/5 px-2 py-1.5"
              >
                <span className="flex-1 min-w-0">
                  <span className="font-mono">{r.numero_pieza}</span>
                  <span className="text-muted-foreground ml-2">
                    {r.articulo ?? '—'}
                    {r.color ? ` · ${r.color}` : ''}
                    {r.ubicacion ? ` · ${r.ubicacion}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setReemplazando(r)}
                  className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                  title="Reemplazar por otro rollo (falla detectada)"
                >
                  <Replace className="size-3" />
                  Reemplazar
                </button>
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
        <ScannerByReaderType
          readerType={readerType}
          onRead={handleLectura}
          paused={Boolean(pendingCode) || confirmando || !!reemplazando}
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

      {reemplazando && (
        <ReemplazoModal
          pedidoId={pedidoId}
          rollo={reemplazando}
          alternativas={alternativas}
          onClose={() => setReemplazando(null)}
          onReemplazado={(rolloNuevo) => {
            setItemsLocales((prev) =>
              prev.map((r) =>
                r.pedido_rollo_id === reemplazando.pedido_rollo_id
                  ? {
                      ...r,
                      rollo_id: rolloNuevo.id,
                      numero_pieza: rolloNuevo.numero_pieza,
                      ubicacion: rolloNuevo.ubicacion,
                      kilos: rolloNuevo.kilos,
                    }
                  : r
              )
            )
            setReemplazando(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function ReemplazoModal({
  pedidoId,
  rollo,
  alternativas,
  onClose,
  onReemplazado,
}: {
  pedidoId: string
  rollo: PickRollo
  alternativas: AlternativaRollo[]
  onClose: () => void
  onReemplazado: (rolloNuevo: AlternativaRollo) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [seleccionado, setSeleccionado] = useState<string>('')
  const [pending, setPending] = useState(false)

  const compatibles = useMemo(
    () =>
      alternativas.filter(
        (a) =>
          a.articulo_id === rollo.articulo_id &&
          a.color_id === rollo.color_id
      ),
    [alternativas, rollo.articulo_id, rollo.color_id]
  )

  async function confirmar() {
    if (!motivo) {
      toast.error('Elegí el motivo del reemplazo.')
      return
    }
    if (!seleccionado) {
      toast.error('Seleccioná el rollo de reemplazo.')
      return
    }
    setPending(true)
    const res = await reemplazarRolloEnPicking({
      pedidoId,
      rolloViejoId: rollo.rollo_id,
      rolloNuevoId: seleccionado,
      motivoCategoria: motivo,
      motivoTexto: descripcion,
    })
    setPending(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    const nuevo = compatibles.find((a) => a.id === seleccionado)!
    toast.success(
      `Pieza ${rollo.numero_pieza} reemplazada por ${nuevo.numero_pieza}.`
    )
    onReemplazado(nuevo)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Reemplazar pieza
          </p>
          <p className="mt-0.5 font-mono text-lg font-bold">
            {rollo.numero_pieza}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {rollo.articulo ?? '—'}
            {rollo.color ? ` · ${rollo.color}` : ''}
            {rollo.kilos != null ? ` · ${Number(rollo.kilos).toFixed(2)} kg` : ''}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            El rollo viejo va a quedar marcado como{' '}
            <strong>segunda calidad</strong> con el motivo elegido. Queda en el
            historial de movimientos.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Motivo del reemplazo *
          </label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Seleccionar...</option>
            {FALLA_CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Descripción (opcional)
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            placeholder="Ej. mancha de 5cm en el extremo"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Rollo de reemplazo *
          </label>
          {compatibles.length === 0 ? (
            <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              No hay rollos disponibles del mismo artículo y color para reemplazar.
              Avisá al admin para que dé de alta nuevo stock o reasigne uno reservado.
            </p>
          ) : (
            <select
              value={seleccionado}
              onChange={(e) => setSeleccionado(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {compatibles.map((a) => (
                <option key={a.id} value={a.id}>
                  Pieza {a.numero_pieza}
                  {a.kilos != null ? ` · ${Number(a.kilos).toFixed(2)} kg` : ''}
                  {a.ubicacion ? ` · ${a.ubicacion}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 rounded-md border px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={pending || !motivo || !seleccionado}
            className="flex-1 rounded-md bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? 'Reemplazando…' : 'Reemplazar'}
          </button>
        </div>
      </div>
    </div>
  )
}
