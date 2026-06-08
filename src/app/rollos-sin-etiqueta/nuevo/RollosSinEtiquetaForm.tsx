'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { obtenerDatosPartida, createRollosSinEtiqueta } from './actions'
import type { UbicacionOption } from '@/lib/ubicaciones'

type Catalog = { id: string; nombre: string }
type ArticuloCatalog = { id: string; nombre: string; colores: Catalog[] }
type IngresoOption = {
  id: string
  numero_lote: string
  fecha_despacho: string
  tintoria_nombre: string
}

type RolloRow = { id: string; kilos: string; ubicacion: string }

function newRow(): RolloRow {
  return { id: crypto.randomUUID(), kilos: '', ubicacion: '' }
}

export default function RollosSinEtiquetaForm({
  ingresos,
  tintorerias,
  articulos,
  ubicaciones,
}: {
  ingresos: IngresoOption[]
  tintorerias: Catalog[]
  articulos: ArticuloCatalog[]
  ubicaciones: UbicacionOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [modo, setModo] = useState<'existente' | 'nuevo'>('existente')

  // Modo A
  const [ingresoSearch, setIngresoSearch] = useState('')
  const [ingresoId, setIngresoId] = useState('')
  const [loadingPartida, setLoadingPartida] = useState(false)
  const [autoAsignado, setAutoAsignado] = useState(false) // artículo/color ya inferidos

  // Artículo y color (comunes a ambos modos)
  const [articuloId, setArticuloId] = useState('')
  const [colorId, setColorId] = useState('')
  const [articuloNombre, setArticuloNombre] = useState('')
  const [colorNombre, setColorNombre] = useState('')

  // Modo B
  const [numeroLote, setNumeroLote] = useState('')
  const [tintoreriaId, setTintoreriaId] = useState('')
  const [fechaDespacho, setFechaDespacho] = useState('')

  // Lista de rollos
  const [rollos, setRollos] = useState<RolloRow[]>([newRow()])

  const [error, setError] = useState<string | null>(null)

  // Colores disponibles para el artículo seleccionado
  const coloresDisponibles = useMemo(() => {
    if (!articuloId) return []
    return articulos.find((a) => a.id === articuloId)?.colores ?? []
  }, [articuloId, articulos])

  // Ingresos filtrados por búsqueda
  const ingresosFiltrados = useMemo(() => {
    if (!ingresoSearch.trim()) return ingresos
    const q = ingresoSearch.toLowerCase()
    return ingresos.filter(
      (i) =>
        i.numero_lote.toLowerCase().includes(q) ||
        i.tintoria_nombre.toLowerCase().includes(q)
    )
  }, [ingresos, ingresoSearch])

  function formatFecha(iso: string) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  async function handleSelectIngreso(id: string) {
    setIngresoId(id)
    setAutoAsignado(false)
    setArticuloId('')
    setColorId('')
    setArticuloNombre('')
    setColorNombre('')
    if (!id) return

    setLoadingPartida(true)
    const result = await obtenerDatosPartida(id)
    setLoadingPartida(false)

    if (!result.ok) {
      setError(result.error)
      return
    }
    if ('sin_rollos' in result) return // show pickers manually

    setArticuloId(result.articulo_id)
    setColorId(result.color_id)
    setArticuloNombre(result.articulo_nombre)
    setColorNombre(result.color_nombre)
    setAutoAsignado(true)
  }

  function handleModoChange(m: 'existente' | 'nuevo') {
    setModo(m)
    setIngresoId('')
    setIngresoSearch('')
    setAutoAsignado(false)
    setArticuloId('')
    setColorId('')
    setArticuloNombre('')
    setColorNombre('')
    setNumeroLote('')
    setTintoreriaId('')
    setFechaDespacho('')
    setError(null)
  }

  function handleArticuloChange(id: string) {
    setArticuloId(id)
    setColorId('')
  }

  function addRow() {
    if (rollos.length >= 20) return
    setRollos((prev) => [...prev, newRow()])
  }

  function removeRow(id: string) {
    setRollos((prev) => prev.filter((r) => r.id !== id))
  }

  function updateRow(id: string, field: 'kilos' | 'ubicacion', value: string) {
    setRollos((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  function handleSubmit() {
    setError(null)

    if (!articuloId) { setError('Seleccioná el artículo.'); return }
    if (!colorId) { setError('Seleccioná el color.'); return }
    if (modo === 'existente' && !ingresoId) { setError('Seleccioná una partida.'); return }
    if (modo === 'nuevo') {
      if (!numeroLote.trim()) { setError('Ingresá el número de partida.'); return }
      if (!tintoreriaId) { setError('Seleccioná la tintorería.'); return }
      if (!fechaDespacho) { setError('Ingresá la fecha.'); return }
    }

    for (const r of rollos) {
      const k = parseFloat(r.kilos)
      if (!r.kilos || isNaN(k) || k <= 0) {
        setError('Los kilos deben ser un número mayor a cero.')
        return
      }
    }

    startTransition(async () => {
      const input =
        modo === 'existente'
          ? {
              modo: 'existente' as const,
              ingreso_id: ingresoId,
              articulo_id: articuloId,
              color_id: colorId,
              rollos: rollos.map((r) => ({
                kilos: parseFloat(r.kilos),
                ubicacion: r.ubicacion || undefined,
              })),
            }
          : {
              modo: 'nuevo' as const,
              numero_lote: numeroLote.trim(),
              tintoreria_id: tintoreriaId,
              fecha_despacho: fechaDespacho,
              articulo_id: articuloId,
              color_id: colorId,
              rollos: rollos.map((r) => ({
                kilos: parseFloat(r.kilos),
                ubicacion: r.ubicacion || undefined,
              })),
            }

      const result = await createRollosSinEtiqueta(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/rollos-sin-etiqueta/etiqueta?ids=${result.ids.join(',')}`)
    })
  }

  const canShowArticuloColor =
    modo === 'nuevo' ||
    (modo === 'existente' && ingresoId && !loadingPartida)

  return (
    <div className="space-y-6">
      {/* Tabs de modo */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => handleModoChange('existente')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            modo === 'existente'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Partida existente
        </button>
        <button
          type="button"
          onClick={() => handleModoChange('nuevo')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            modo === 'nuevo'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Nueva partida
        </button>
      </div>

      {/* Modo A: Partida existente */}
      {modo === 'existente' && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Seleccionar partida</h2>
          <div>
            <input
              type="text"
              placeholder="Buscar por número de partida o tintorería..."
              value={ingresoSearch}
              onChange={(e) => setIngresoSearch(e.target.value)}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-2"
            />
            <select
              value={ingresoId}
              onChange={(e) => handleSelectIngreso(e.target.value)}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Elegir partida —</option>
              {ingresosFiltrados.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.numero_lote || '(sin número)'} · {i.tintoria_nombre} · {formatFecha(i.fecha_despacho)}
                </option>
              ))}
            </select>
          </div>
          {loadingPartida && (
            <p className="text-xs text-muted-foreground">Cargando datos de la partida...</p>
          )}
          {ingresoId && !loadingPartida && autoAsignado && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Artículo: </span>
              <span className="font-medium">{articuloNombre}</span>
              <span className="text-muted-foreground mx-2">·</span>
              <span className="text-muted-foreground">Color: </span>
              <span className="font-medium">{colorNombre}</span>
            </div>
          )}
        </div>
      )}

      {/* Modo B: Nueva partida */}
      {modo === 'nuevo' && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Datos de la nueva partida</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Número de partida <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={numeroLote}
                onChange={(e) => setNumeroLote(e.target.value)}
                placeholder="ej: L-2026-042 o MUTER-001"
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Fecha de despacho <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={fechaDespacho}
                onChange={(e) => setFechaDespacho(e.target.value)}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Tintorería <span className="text-destructive">*</span>
            </label>
            <select
              value={tintoreriaId}
              onChange={(e) => setTintoreriaId(e.target.value)}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Elegir tintorería —</option>
              {tintorerias.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Artículo y color (cuando aplica) */}
      {canShowArticuloColor && !autoAsignado && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Artículo y color</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Artículo <span className="text-destructive">*</span>
              </label>
              <select
                value={articuloId}
                onChange={(e) => handleArticuloChange(e.target.value)}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Elegir artículo —</option>
                {articulos.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Color <span className="text-destructive">*</span>
              </label>
              <select
                value={colorId}
                onChange={(e) => setColorId(e.target.value)}
                disabled={!articuloId}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">— Elegir color —</option>
                {coloresDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Lista de rollos */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Rollos</h2>

        <div className="space-y-2">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[1fr_1.5fr_2fr_auto] gap-3 px-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">N° pieza</p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Kilos *</p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ubicación</p>
            <p className="w-8" />
          </div>

          {rollos.map((rollo, idx) => (
            <div
              key={rollo.id}
              className="grid grid-cols-[1fr_1.5fr_2fr_auto] sm:grid-cols-[1fr_1.5fr_2fr_auto] gap-3 items-center"
            >
              <div className="flex items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                <span className="text-xs">Auto</span>
              </div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={rollo.kilos}
                onChange={(e) => updateRow(rollo.id, 'kilos', e.target.value)}
                placeholder="0.0"
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                value={rollo.ubicacion}
                onChange={(e) => updateRow(rollo.id, 'ubicacion', e.target.value)}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Ubicación —</option>
                {ubicaciones.map((u) => (
                  <option key={u.codigo} value={u.codigo}>
                    {u.codigo}{u.descripcion ? ` - ${u.descripcion}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(rollo.id)}
                disabled={rollos.length === 1}
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive transition-colors disabled:opacity-30"
                aria-label="Eliminar fila"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        {rollos.length < 20 && (
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
          >
            <Plus className="size-4" />
            Agregar rollo
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Guardando...' : 'Guardar y generar etiquetas'}
      </button>
    </div>
  )
}
