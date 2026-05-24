'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { StockRollo, StockRole } from './StockList'
import {
  darDeBajaRollo,
  moverUbicacion,
  marcarComoSegunda,
  confirmarRolloManual,
  auditarRollo,
  subirFotoRollo,
  listarFotosRollo,
  FALLA_CATEGORIAS,
  FALLA_CATEGORIA_LABEL,
  type FallaCategoria,
  type RolloFotoConUrl,
} from './actions'
import { UBICACIONES } from '@/lib/ubicaciones'

const ESTADO_TEXT: Record<string, string> = {
  pendiente: 'Pendiente',
  en_stock: 'En stock',
  reservado: 'Reservado',
  entregado: 'Entregado',
  baja: 'Baja',
  segunda: 'Segunda',
}

// El padre remonta este componente con `key={rollo.id}` cuando cambia el rollo
// seleccionado, así el estado interno (mode/ubicacion) arranca limpio sin
// necesidad de resetearlo en un useEffect.
export default function RolloDetailDialog({
  rollo,
  role,
  onClose,
}: {
  rollo: StockRollo
  role: StockRole
  onClose: () => void
}) {
  const [mode, setMode] = useState<
    'view' | 'mover' | 'baja' | 'segunda' | 'confirmar' | 'auditar'
  >('view')
  const [ubicacion, setUbicacion] = useState(rollo.ubicacion ?? '')
  const [confirmUbicacion, setConfirmUbicacion] = useState('')
  const [pending, startTransition] = useTransition()

  // Formulario de "segunda"
  const [fallaCategoria, setFallaCategoria] = useState<FallaCategoria | ''>('')
  const [fallaDescripcion, setFallaDescripcion] = useState('')
  const [fallaArchivos, setFallaArchivos] = useState<File[]>([])
  const [subiendoIdx, setSubiendoIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Galería de fotos ya existentes para este rollo. Inicializamos el flag
  // de "cargando" según el estado inicial del rollo para evitar setState
  // síncrono dentro del effect (regla react-hooks/set-state-in-effect).
  const [fotos, setFotos] = useState<RolloFotoConUrl[]>([])
  const [fotosCargando, setFotosCargando] = useState(
    rollo.estado === 'segunda'
  )
  const [fotoAmpliada, setFotoAmpliada] = useState<RolloFotoConUrl | null>(null)

  useEffect(() => {
    if (rollo.estado !== 'segunda') return
    let cancelado = false
    listarFotosRollo(rollo.id).then((res) => {
      if (cancelado) return
      if (res.ok) setFotos(res.fotos)
      setFotosCargando(false)
    })
    return () => {
      cancelado = true
    }
  }, [rollo.id, rollo.estado])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (fotoAmpliada) {
        setFotoAmpliada(null)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, fotoAmpliada])

  const esOperarioOAdmin = role === 'operario' || role === 'admin'
  const puedeMover =
    esOperarioOAdmin &&
    (rollo.estado === 'en_stock' || rollo.estado === 'pendiente')
  const puedeSegunda =
    esOperarioOAdmin &&
    (rollo.estado === 'en_stock' || rollo.estado === 'pendiente')
  const puedeBaja = role === 'admin' && rollo.estado !== 'baja' && rollo.estado !== 'entregado'
  const puedeConfirmar = esOperarioOAdmin && rollo.estado === 'pendiente'
  const puedeAuditar =
    esOperarioOAdmin &&
    ['en_stock', 'reservado', 'segunda'].includes(rollo.estado)

  function handleMover() {
    startTransition(async () => {
      const res = await moverUbicacion(rollo.id, ubicacion)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Pieza ${rollo.numero_pieza} movida a ${ubicacion.trim()}.`)
      onClose()
    })
  }

  function handleSegunda() {
    if (!fallaCategoria) {
      toast.error('Elegí una categoría de falla.')
      return
    }
    startTransition(async () => {
      // Subimos las fotos primero. Si alguna falla, abortamos antes de
      // cambiar el estado del rollo para que el operario pueda reintentar.
      const fotoPaths: string[] = []
      for (let i = 0; i < fallaArchivos.length; i++) {
        setSubiendoIdx(i)
        const fd = new FormData()
        fd.set('archivo', fallaArchivos[i])
        fd.set('rollo_id', rollo.id)
        const res = await subirFotoRollo(fd)
        if (!res.ok) {
          setSubiendoIdx(null)
          toast.error(`No se pudo subir la foto ${i + 1}: ${res.error}`)
          return
        }
        fotoPaths.push(res.path)
      }
      setSubiendoIdx(null)

      const res = await marcarComoSegunda(rollo.id, {
        categoria: fallaCategoria,
        descripcion: fallaDescripcion,
        fotoPaths,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Pieza ${rollo.numero_pieza} marcada como segunda calidad.`)
      onClose()
    })
  }

  function handleArchivosSeleccionados(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const nuevos = Array.from(files)
    setFallaArchivos((prev) => [...prev, ...nuevos])
    // Reset para permitir volver a elegir el mismo archivo si se quitó
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function quitarArchivo(idx: number) {
    setFallaArchivos((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleBaja() {
    startTransition(async () => {
      const res = await darDeBajaRollo(rollo.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Pieza ${rollo.numero_pieza} dada de baja.`)
      onClose()
    })
  }

  function handleConfirmar() {
    startTransition(async () => {
      const res = await confirmarRolloManual(rollo.id, confirmUbicacion)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        `Pieza ${rollo.numero_pieza} confirmada en ${confirmUbicacion.trim()}.`
      )
      onClose()
    })
  }

  function handleAuditar() {
    startTransition(async () => {
      const res = await auditarRollo(rollo.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Auditoría registrada para la pieza ${rollo.numero_pieza}.`)
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-lg shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h2 className="font-semibold">Pieza {rollo.numero_pieza}</h2>
            <p className="text-xs text-muted-foreground truncate">
              {rollo.articulos?.nombre ?? '—'}
              {rollo.ingresos?.color ? ` · ${rollo.ingresos.color}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 hover:bg-zinc-100 shrink-0"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Foto / placeholder */}
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-zinc-100 flex items-center justify-center">
            {rollo.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={rollo.foto_url}
                alt={`Rollo ${rollo.numero_pieza}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <p className="text-3xl font-bold tracking-wider">
                  {(rollo.ingresos?.color ?? '—').slice(0, 3).toUpperCase()}
                </p>
                <p className="text-xs mt-1">Sin foto</p>
              </div>
            )}
          </div>

          {/* Metadata */}
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <Field
              label="Estado"
              value={ESTADO_TEXT[rollo.estado] ?? rollo.estado}
            />
            <Field label="Ubicación" value={rollo.ubicacion ?? '—'} />
            <Field label="Pantone" value={rollo.pantone ?? '—'} />
            <Field label="Kilos" value={fmt(rollo.kilos, 'kg')} />
            <Field label="Metros" value={fmt(rollo.metros, 'm')} />
            <Field
              label="Gramaje (planilla)"
              value={fmt(rollo.gramaje_planilla)}
            />
            <Field label="Kilos propios" value={fmt(rollo.kilos_propios, 'kg')} />
            <Field
              label="Metros propios"
              value={fmt(rollo.metros_propios, 'm')}
            />
            <Field
              label="Ancho propio"
              value={fmt(rollo.ancho_propio, 'cm')}
            />
            <Field label="Gramaje propio" value={fmt(rollo.gramaje_propio)} />
          </dl>

          <div className="rounded-md bg-zinc-50 border p-3 text-xs space-y-1">
            <p className="font-medium text-foreground">Origen</p>
            <p>
              <span className="text-muted-foreground">Tintorería: </span>
              {rollo.ingresos?.tintorerias?.nombre ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Fecha despacho: </span>
              {rollo.ingresos?.fecha_despacho ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Remito: </span>
              {rollo.ingresos?.numero_remito ?? '—'}
            </p>
            {rollo.ingresos?.ot && (
              <p>
                <span className="text-muted-foreground">OT: </span>
                {rollo.ingresos.ot}
              </p>
            )}
            {rollo.ingresos?.referencia && (
              <p>
                <span className="text-muted-foreground">Referencia: </span>
                {rollo.ingresos.referencia}
              </p>
            )}
            {rollo.ingresos?.rem_tejeduria && (
              <p>
                <span className="text-muted-foreground">Rem. tejeduría: </span>
                {rollo.ingresos.rem_tejeduria}
              </p>
            )}
            {rollo.auditado_at && (
              <p>
                <span className="text-muted-foreground">Última auditoría: </span>
                {formatFecha(rollo.auditado_at)}
              </p>
            )}
          </div>

          {/* Detalle de segunda calidad */}
          {rollo.estado === 'segunda' && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-medium text-amber-900">Falla registrada</p>
                {rollo.falla_categoria && (
                  <span className="rounded-full bg-amber-200 text-amber-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    {FALLA_CATEGORIA_LABEL[
                      rollo.falla_categoria as FallaCategoria
                    ] ?? rollo.falla_categoria}
                  </span>
                )}
              </div>
              {rollo.falla_descripcion && (
                <p className="text-amber-900 whitespace-pre-wrap">
                  {rollo.falla_descripcion}
                </p>
              )}
              {!rollo.falla_categoria && !rollo.falla_descripcion && (
                <p className="text-amber-800/70">
                  Sin categoría ni detalle cargados. Marcala de nuevo desde
                  acciones para sumar esa información.
                </p>
              )}

              {fotosCargando ? (
                <p className="text-amber-800/70">Cargando fotos…</p>
              ) : fotos.length > 0 ? (
                <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                  {fotos.map((f) => (
                    <li
                      key={f.id}
                      className="aspect-square rounded-md overflow-hidden border bg-white"
                    >
                      {f.signedUrl ? (
                        <button
                          type="button"
                          onClick={() => setFotoAmpliada(f)}
                          className="block w-full h-full"
                          aria-label="Ampliar foto"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={f.signedUrl}
                            alt={f.descripcion ?? 'Foto de la falla'}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground p-1 text-center">
                          No se pudo cargar
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {/* Acciones */}
          {mode === 'view' &&
            (puedeConfirmar ||
              puedeAuditar ||
              puedeMover ||
              puedeSegunda ||
              puedeBaja) && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {puedeConfirmar && (
                  <button
                    type="button"
                    onClick={() => setMode('confirmar')}
                    className="rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium hover:bg-success/90 transition-colors"
                  >
                    Confirmar manualmente
                  </button>
                )}
                {puedeAuditar && (
                  <button
                    type="button"
                    onClick={() => setMode('auditar')}
                    className="rounded-md border border-primary/40 text-primary px-4 py-2 text-sm font-medium hover:bg-primary/5 transition-colors"
                  >
                    Auditar
                  </button>
                )}
                {puedeMover && (
                  <button
                    type="button"
                    onClick={() => setMode('mover')}
                    className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Mover ubicación
                  </button>
                )}
                {puedeSegunda && (
                  <button
                    type="button"
                    onClick={() => setMode('segunda')}
                    className="rounded-md border border-amber-400/40 text-amber-700 px-4 py-2 text-sm font-medium hover:bg-amber-50 transition-colors"
                  >
                    Marcar como segunda
                  </button>
                )}
                {puedeBaja && (
                  <button
                    type="button"
                    onClick={() => setMode('baja')}
                    className="rounded-md border border-destructive/40 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/5 transition-colors"
                  >
                    Dar de baja
                  </button>
                )}
              </div>
            )}

          {mode === 'confirmar' && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm">
                Confirmar manualmente la pieza{' '}
                <strong>{rollo.numero_pieza}</strong>. El rollo pasa de
                pendiente a en stock.
              </p>
              <label className="text-sm font-medium block">
                Ubicación asignada *
              </label>
              <input
                type="text"
                list="ubicaciones-dialog-list"
                value={confirmUbicacion}
                onChange={(e) => setConfirmUbicacion(e.target.value)}
                placeholder="Ej. A1"
                className="w-full rounded-md border px-3 py-2 text-sm"
                autoFocus
              />
              <datalist id="ubicaciones-dialog-list">
                {UBICACIONES.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Si el rollo ya está en el depósito sin haber sido escaneado por
                cámara, este atajo permite cerrarlo a mano.
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  disabled={pending}
                  className="text-sm px-3 py-2 hover:bg-zinc-100 rounded-md disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmar}
                  disabled={pending || !confirmUbicacion.trim()}
                  className="rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {pending ? 'Confirmando…' : 'Confirmar y pasar a stock'}
                </button>
              </div>
            </div>
          )}

          {mode === 'auditar' && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm">
                Registrar auditoría de la pieza{' '}
                <strong>{rollo.numero_pieza}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Esto no cambia el estado del rollo, pero deja registro de quién
                lo verificó físicamente y cuándo.
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  disabled={pending}
                  className="text-sm px-3 py-2 hover:bg-zinc-100 rounded-md disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAuditar}
                  disabled={pending}
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {pending ? 'Registrando…' : 'Confirmar auditoría'}
                </button>
              </div>
            </div>
          )}

          {mode === 'mover' && (
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">Nueva ubicación</label>
              <input
                type="text"
                list="ubicaciones-dialog-list"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej. A1"
                className="w-full rounded-md border px-3 py-2 text-sm"
                autoFocus
              />
              <datalist id="ubicaciones-dialog-list">
                {UBICACIONES.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  disabled={pending}
                  className="text-sm px-3 py-2 hover:bg-zinc-100 rounded-md disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleMover}
                  disabled={pending}
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {pending ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {mode === 'segunda' && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm">
                Marcar la pieza <strong>{rollo.numero_pieza}</strong> como
                segunda calidad. Documentá la falla ahora para evitar el ida y
                vuelta con el cliente.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-medium block">
                  Categoría de falla <span className="text-destructive">*</span>
                </label>
                <select
                  value={fallaCategoria}
                  onChange={(e) =>
                    setFallaCategoria(e.target.value as FallaCategoria | '')
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                  autoFocus
                >
                  <option value="">Seleccionar...</option>
                  {FALLA_CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {FALLA_CATEGORIA_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium block">
                  Detalle (opcional)
                </label>
                <textarea
                  value={fallaDescripcion}
                  onChange={(e) => setFallaDescripcion(e.target.value)}
                  placeholder="Ej. Mancha en el borde a la mitad del rollo. Tono más claro de un costado."
                  rows={3}
                  className="w-full rounded-md border px-3 py-2 text-sm resize-y"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium block">
                  Fotos de la falla (opcional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleArchivosSeleccionados}
                  disabled={pending}
                  className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-amber-800 hover:file:bg-amber-200"
                />
                {fallaArchivos.length > 0 && (
                  <ul className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {fallaArchivos.map((file, idx) => {
                      const url = URL.createObjectURL(file)
                      const subiendoEsta = subiendoIdx === idx
                      return (
                        <li
                          key={`${file.name}-${idx}`}
                          className="relative aspect-square rounded-md overflow-hidden border bg-zinc-50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {subiendoEsta && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-medium">
                              Subiendo…
                            </div>
                          )}
                          {!pending && (
                            <button
                              type="button"
                              onClick={() => quitarArchivo(idx)}
                              className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center hover:bg-black/80"
                              aria-label="Quitar foto"
                            >
                              ×
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  disabled={pending}
                  className="text-sm px-3 py-2 hover:bg-zinc-100 rounded-md disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSegunda}
                  disabled={pending || !fallaCategoria}
                  className="rounded-md bg-amber-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {pending
                    ? subiendoIdx !== null && fallaArchivos.length > 0
                      ? `Subiendo ${subiendoIdx + 1}/${fallaArchivos.length}…`
                      : 'Marcando…'
                    : 'Confirmar segunda'}
                </button>
              </div>
            </div>
          )}

          {mode === 'baja' && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm">
                ¿Confirmás dar de baja la pieza{' '}
                <strong>{rollo.numero_pieza}</strong>?
              </p>
              <p className="text-xs text-muted-foreground">
                El rollo va a quedar en estado &ldquo;Baja&rdquo; y deja de
                figurar como disponible. Esta acción no se puede deshacer desde
                la app.
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  disabled={pending}
                  className="text-sm px-3 py-2 hover:bg-zinc-100 rounded-md disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBaja}
                  disabled={pending}
                  className="rounded-md bg-destructive text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {pending ? 'Dando de baja…' : 'Confirmar baja'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {fotoAmpliada?.signedUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation()
            setFotoAmpliada(null)
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoAmpliada.signedUrl}
            alt={fotoAmpliada.descripcion ?? 'Foto ampliada'}
            className="max-w-full max-h-full object-contain"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setFotoAmpliada(null)
            }}
            aria-label="Cerrar foto"
            className="absolute top-3 right-3 rounded-full bg-white/90 text-foreground p-2 hover:bg-white"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium truncate">{value}</dd>
    </div>
  )
}

function fmt(v: number | null, suffix?: string): string {
  if (v == null) return '—'
  const num = Number(v)
  if (Number.isNaN(num)) return '—'
  return `${num.toLocaleString('es-AR', {
    maximumFractionDigits: 2,
  })}${suffix ? ' ' + suffix : ''}`
}

function formatFecha(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
