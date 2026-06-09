'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { type CodeScannerResult } from '@/components/CodeScanner'
import ScannerByReaderType, {
  type ReaderType,
} from '@/components/ScannerByReaderType'
import { extraerCodigoCandidato, type PatronCodigo } from '@/lib/scanner'
import { pickearRollo, reemplazarRolloEnPicking } from './actions'

export type PickPartida = {
  id: string
  numeroLote: string | null
  articuloId: string
  colorId: string
  articulo: string
  color: string
  tintoreria: string | null
  rollosSolicitados: number
  rollosAsignados: number
  ubicacionesSugeridas: string[]
}

export type PickRollo = {
  pedido_rollo_id: string
  pedido_partida_id: string | null
  pickeado_at: string | null
  rollo_id: string
  numero_pieza: string
  ubicacion: string | null
  kilos: number | null
  articulo_id: string | null
  color_id: string | null
  articulo: string | null
  color: string | null
  partidaRealLote: string | null
  partidaSolicitadaLote: string | null
  esSustitucionPartida: boolean
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

export default function PickingScanner({
  pedidoId,
  partidas,
  items,
  patrones,
  readerType,
}: {
  pedidoId: string
  partidas: PickPartida[]
  items: PickRollo[]
  alternativas: AlternativaRollo[]
  patrones: PatronCodigo[]
  readerType: ReaderType
}) {
  const router = useRouter()
  const [partidasLocales, setPartidasLocales] = useState<PickPartida[]>(partidas)
  const [itemsLocales, setItemsLocales] = useState<PickRollo[]>(items)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [reemplazando, setReemplazando] = useState(false)
  const [reemplazoTarget, setReemplazoTarget] = useState<PickRollo | null>(null)
  const [numeroReemplazo, setNumeroReemplazo] = useState('')
  const [motivoReemplazo, setMotivoReemplazo] = useState('')
  const [mostrarPartidas, setMostrarPartidas] = useState(true)
  const [mostrarPickeados, setMostrarPickeados] = useState(true)

  const total = partidasLocales.reduce((acc, p) => acc + p.rollosSolicitados, 0)
  const pickeados = itemsLocales.filter((r) => r.pickeado_at != null).length
  const pendientes = Math.max(0, total - pickeados)
  const progresoPct = total > 0 ? Math.round((pickeados / total) * 100) : 0
  const completo = total > 0 && pendientes === 0
  const kilosReales = itemsLocales.reduce((acc, r) => acc + Number(r.kilos ?? 0), 0)

  const articuloColorByPartida = useMemo(() => {
    const map = new Map<string, PickPartida>()
    for (const p of partidasLocales) map.set(p.id, p)
    return map
  }, [partidasLocales])

  const ejecutarPickeo = useCallback(
    async (textoEscaneado: string) => {
      setConfirmando(true)
      const res = await pickearRollo(pedidoId, textoEscaneado)
      setConfirmando(false)

      if (!res.ok) {
        setPendingCode(null)
        if (res.error.includes('ya fue pickeado')) toast.warning(res.error)
        else toast.error(res.error)
        return
      }

      const partida = articuloColorByPartida.get(res.pedidoPartidaId)
      const now = new Date().toISOString()

      setItemsLocales((prev) => [
        ...prev,
        {
          pedido_rollo_id: res.rolloId,
          pedido_partida_id: res.pedidoPartidaId,
          pickeado_at: now,
          rollo_id: res.rolloId,
          numero_pieza: res.numeroPieza,
          ubicacion: res.ubicacion,
          kilos: res.kilos,
          articulo_id: res.articuloId,
          color_id: res.colorId,
          articulo: partida?.articulo ?? null,
          color: partida?.color ?? null,
          partidaRealLote: res.partidaRealLote,
          partidaSolicitadaLote: res.partidaSolicitadaLote,
          esSustitucionPartida: res.esSustitucionPartida,
        },
      ])
      setPartidasLocales((prev) =>
        prev.map((p) =>
          p.id === res.pedidoPartidaId
            ? { ...p, rollosAsignados: p.rollosAsignados + 1 }
            : p
        )
      )
      setPendingCode(null)

      if (res.pedidoCompleto) {
        toast.success('Picking completo. El pedido queda Listo.')
        setTimeout(() => router.refresh(), 900)
        return
      }

      if (res.esSustitucionPartida) {
        toast.warning(
          `Pieza ${res.numeroPieza} pickeada de ${res.partidaRealLote ?? 'otra partida'} en lugar de ${res.partidaSolicitadaLote ?? 'la solicitada'}.`
        )
      } else {
        toast.success(
          `Pieza ${res.numeroPieza} pickeada (${res.total - res.pendientes}/${res.total}).`
        )
      }
    },
    [articuloColorByPartida, pedidoId, router]
  )

  const handleLectura = useCallback(
    (result: CodeScannerResult) => {
      const candidato = extraerCodigoCandidato(result.texto, patrones) ?? result.texto.trim()
      if (!candidato) {
        toast.error('No reconocimos el codigo. Probalo de nuevo o ingresalo manualmente.')
        return
      }
      setPendingCode(candidato)
    },
    [patrones]
  )

  async function ejecutarReemplazo() {
    if (!reemplazoTarget) return
    const numero = numeroReemplazo.trim()
    if (!numero) {
      toast.error('Ingresá el número de pieza nuevo.')
      return
    }

    setReemplazando(true)
    const res = await reemplazarRolloEnPicking({
      pedidoId,
      rolloViejoId: reemplazoTarget.rollo_id,
      numeroPiezaNuevo: numero,
      motivo: motivoReemplazo,
    })
    setReemplazando(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }

    const partida = articuloColorByPartida.get(res.pedidoPartidaId)
    setItemsLocales((prev) =>
      prev.map((item) =>
        item.rollo_id === reemplazoTarget.rollo_id
          ? {
              ...item,
              pedido_rollo_id: res.pedidoRolloId,
              pedido_partida_id: res.pedidoPartidaId,
              pickeado_at: new Date().toISOString(),
              rollo_id: res.rolloId,
              numero_pieza: res.numeroPieza,
              ubicacion: res.ubicacion,
              kilos: res.kilos,
              articulo_id: res.articuloId,
              color_id: res.colorId,
              articulo: partida?.articulo ?? item.articulo,
              color: partida?.color ?? item.color,
              partidaRealLote: res.partidaRealLote,
              partidaSolicitadaLote: res.partidaSolicitadaLote,
              esSustitucionPartida: res.esSustitucionPartida,
            }
          : item
      )
    )

    toast.success(
      `Rollo ${reemplazoTarget.numero_pieza} reemplazado por ${res.numeroPieza}.`
    )
    setReemplazoTarget(null)
    setNumeroReemplazo('')
    setMotivoReemplazo('')
    router.refresh()
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
        <p className="text-xs text-muted-foreground tabular-nums">
          Kg reales pickeados:{' '}
          <strong className="text-foreground">{kilosReales.toFixed(2)}</strong>
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setMostrarPartidas((v) => !v)}
          className="flex w-full items-center justify-between text-left text-sm font-semibold"
        >
          <span>Partidas solicitadas</span>
          <span className="text-xs text-muted-foreground">
            {mostrarPartidas ? 'Ocultar' : 'Ver'}
          </span>
        </button>
        {mostrarPartidas && (
          <ul className="mt-3 space-y-2 text-sm">
            {partidasLocales.map((p) => {
              const faltan = Math.max(0, p.rollosSolicitados - p.rollosAsignados)
              return (
                <li key={p.id} className="rounded-md border bg-zinc-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        Partida {p.numeroLote ?? 'sin numero'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.articulo} - {p.color}
                        {p.tintoreria ? ` - ${p.tintoreria}` : ''}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        faltan === 0
                          ? 'bg-success/15 text-success'
                          : 'bg-warning/15 text-warning'
                      }`}
                    >
                      {p.rollosAsignados}/{p.rollosSolicitados}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {faltan === 0 ? 'Completa' : `Faltan ${faltan} rollos`}
                  </p>
                  {p.ubicacionesSugeridas.length > 0 && faltan > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Buscar en:{' '}
                      <span className="font-medium text-foreground">
                        {p.ubicacionesSugeridas.join(', ')}
                      </span>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {completo ? (
        <div className="space-y-2 rounded-lg border border-success/30 bg-success/10 p-5 text-center">
          <p className="font-semibold text-success">Pedido listo</p>
          <p className="text-sm text-muted-foreground">
            Ya se pickearon todos los rollos solicitados. Queda esperando egreso.
          </p>
        </div>
      ) : (
        <ScannerByReaderType
          readerType={readerType}
          onRead={handleLectura}
          paused={Boolean(pendingCode) || confirmando}
          title={
            readerType === 'qr'
              ? 'Escanear codigo QR'
              : readerType === 'barcode'
                ? 'Escanear codigo de barras'
                : 'Escanear QR o codigo de barras'
          }
          manualLabel="Ingresar pieza manualmente"
          manualPlaceholder="Ej: 204021911"
        />
      )}

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setMostrarPickeados((v) => !v)}
          className="flex w-full items-center justify-between text-left text-sm font-semibold"
        >
          <span>Rollos reales pickeados</span>
          <span className="text-xs text-muted-foreground">
            {mostrarPickeados ? 'Ocultar' : 'Ver'} ({itemsLocales.length})
          </span>
        </button>
        {mostrarPickeados && (
          <div className="mt-3 overflow-x-auto">
            {itemsLocales.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Todavia no se pickeo ningun rollo.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Pieza</th>
                    <th className="py-2 pr-3 font-medium">Articulo</th>
                    <th className="py-2 pr-3 font-medium">Color</th>
                    <th className="py-2 pr-3 font-medium">Partida</th>
                    <th className="py-2 pr-3 font-medium">Ubic.</th>
                    <th className="py-2 text-right font-medium">Kg</th>
                    <th className="py-2 pl-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {itemsLocales.map((r) => (
                    <tr key={`${r.rollo_id}-${r.pickeado_at}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono font-medium">
                        {r.numero_pieza}
                      </td>
                      <td className="py-2 pr-3">{r.articulo ?? '-'}</td>
                      <td className="py-2 pr-3">{r.color ?? '-'}</td>
                      <td className="py-2 pr-3 text-xs">
                        <span className={r.esSustitucionPartida ? 'text-warning' : ''}>
                          {r.partidaRealLote ?? '-'}
                        </span>
                        {r.esSustitucionPartida && (
                          <span className="block text-[11px] text-muted-foreground">
                            Solicitada: {r.partidaSolicitadaLote ?? '-'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{r.ubicacion ?? '-'}</td>
                      <td className="py-2 text-right tabular-nums">
                        {r.kilos != null ? Number(r.kilos).toFixed(2) : '-'}
                      </td>
                      <td className="py-2 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setReemplazoTarget(r)
                            setNumeroReemplazo('')
                            setMotivoReemplazo('')
                          }}
                          className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50"
                        >
                          Reemplazar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      {pendingCode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Pieza detectada
              </p>
              <p className="mt-0.5 break-all font-mono text-lg font-bold">
                {pendingCode}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                El sistema va a validar que pertenezca a una partida pendiente de este pedido.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingCode(null)}
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

      {reemplazoTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Reemplazar rollo pickeado
              </p>
              <p className="mt-1 text-sm">
                Sale{' '}
                <strong className="font-mono">
                  {reemplazoTarget.numero_pieza}
                </strong>
                . Ingresá la pieza que queda en su lugar.
              </p>
            </div>

            <div className="space-y-3">
              <Field label="Nueva pieza">
                <input
                  type="text"
                  value={numeroReemplazo}
                  onChange={(e) => setNumeroReemplazo(e.target.value)}
                  placeholder="Ej. 204021911"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Motivo">
                <textarea
                  value={motivoReemplazo}
                  onChange={(e) => setMotivoReemplazo(e.target.value)}
                  rows={2}
                  placeholder="Ej. error de selección, rollo dañado, cambio solicitado"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReemplazoTarget(null)}
                disabled={reemplazando}
                className="flex-1 rounded-md border px-4 py-2.5 text-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutarReemplazo}
                disabled={reemplazando || !numeroReemplazo.trim()}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {reemplazando ? 'Reemplazando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
