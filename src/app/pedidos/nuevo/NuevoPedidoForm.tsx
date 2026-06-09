'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { crearCliente } from '@/app/clientes/actions'
import { crearPedidoPorPartidas } from '../actions'
import SearchableCombobox from '@/components/SearchableCombobox'

export type Catalogo = { id: string; nombre: string }

export type PartidaDisponible = {
  key: string
  ingresoId: string
  numeroLote: string | null
  articuloId: string
  articuloNombre: string
  colorId: string
  colorNombre: string
  tintoreriaNombre: string | null
  rollosDisponibles: number
  kilosDisponibles: number
  rollosPendientesPrevios: number
  rollosEstimacion: Array<{
    numeroPieza: string
    kilos: number
    ubicacion: string | null
  }>
}

type Filters = {
  q: string
  articulo: string
  color: string
  tintoreria: string
  diasMinimos: string
}

export default function NuevoPedidoForm({
  partidasDisponibles,
  articulos,
  colores,
  tintorerias,
  clientes: clientesIniciales,
  currentFilters,
}: {
  partidasDisponibles: PartidaDisponible[]
  articulos: Catalogo[]
  colores: Catalogo[]
  tintorerias: Catalogo[]
  clientes: Catalogo[]
  currentFilters: Filters
}) {
  const router = useRouter()
  const sp = useSearchParams()

  const [clientes, setClientes] = useState(clientesIniciales)
  const [clienteId, setClienteId] = useState('')
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('')
  const [creandoCliente, startClienteTransition] = useTransition()
  const [remito, setRemito] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [filtroPending, startFiltroTransition] = useTransition()
  const [submitPending, startSubmitTransition] = useTransition()

  const partidasByKey = useMemo(
    () => new Map(partidasDisponibles.map((p) => [p.key, p])),
    [partidasDisponibles]
  )

  const seleccionadas = Object.entries(cantidades)
    .map(([key, cantidad]) => ({ partida: partidasByKey.get(key), cantidad }))
    .filter(
      (row): row is { partida: PartidaDisponible; cantidad: number } =>
        !!row.partida && row.cantidad > 0
    )

  const totalRollos = seleccionadas.reduce((acc, row) => acc + row.cantidad, 0)

  function updateFilter(field: keyof Filters, value: string) {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(field, value)
    else params.delete(field)
    const qs = params.toString()
    startFiltroTransition(() => {
      router.replace(qs ? `/pedidos/nuevo?${qs}` : '/pedidos/nuevo')
    })
  }

  function resetFilters() {
    startFiltroTransition(() => {
      router.replace('/pedidos/nuevo')
    })
  }

  function setCantidad(partida: PartidaDisponible, value: number) {
    const next = Math.max(0, Math.min(partida.rollosDisponibles, Math.trunc(value || 0)))
    setCantidades((prev) => {
      const clone = { ...prev }
      if (next <= 0) delete clone[partida.key]
      else clone[partida.key] = next
      return clone
    })
  }

  function handleCrearCliente() {
    const nombre = nuevoClienteNombre.trim()
    if (!nombre) return
    startClienteTransition(async () => {
      const res = await crearCliente({ nombre })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setClientes((prev) =>
        [...prev, res.cliente].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      )
      setClienteId(res.cliente.id)
      setNuevoCliente(false)
      setNuevoClienteNombre('')
      toast.success(`Cliente "${res.cliente.nombre}" creado.`)
    })
  }

  function handleSubmit() {
    setError(null)
    if (!clienteId) {
      setError('Elegi un cliente del catalogo o crea uno nuevo.')
      return
    }
    if (seleccionadas.length === 0) {
      setError('Agrega al menos una partida al pedido.')
      return
    }

    startSubmitTransition(async () => {
      const res = await crearPedidoPorPartidas(
        clienteId,
        remito,
        seleccionadas.map(({ partida, cantidad }) => ({
          ingresoId: partida.ingresoId,
          articuloId: partida.articuloId,
          colorId: partida.colorId,
          cantidad,
        })),
        fechaEntrega
      )
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Pedido creado con ${totalRollos} rollos solicitados.`)
      router.push(`/pedidos/${res.pedidoId}?creado=1`)
    })
  }

  const hasFilters =
    !!currentFilters.q ||
    !!currentFilters.articulo ||
    !!currentFilters.color ||
    !!currentFilters.tintoreria ||
    !!currentFilters.diasMinimos

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-sm">Datos del pedido</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="min-w-0 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Cliente <span className="text-destructive">*</span>
            </label>
            {!nuevoCliente ? (
              <>
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNuevoCliente(true)}
                  className="text-xs text-primary hover:underline"
                >
                  + Nuevo cliente
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={nuevoClienteNombre}
                  onChange={(e) => setNuevoClienteNombre(e.target.value)}
                  placeholder="Nombre del cliente nuevo"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleCrearCliente()
                    } else if (e.key === 'Escape') {
                      setNuevoCliente(false)
                      setNuevoClienteNombre('')
                    }
                  }}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCrearCliente}
                    disabled={creandoCliente || !nuevoClienteNombre.trim()}
                    className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {creandoCliente ? '...' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoCliente(false)
                      setNuevoClienteNombre('')
                    }}
                    className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          <Field label="Nro remito externo">
            <input
              type="text"
              value={remito}
              onChange={(e) => setRemito(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Fecha de entrega comprometida">
            <input
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-sm">
            Partidas seleccionadas ({seleccionadas.length})
          </h2>
          {totalRollos > 0 && (
            <span className="text-sm tabular-nums text-muted-foreground">
              Total: <strong className="text-foreground">{totalRollos} rollos</strong>
            </span>
          )}
        </div>

        {seleccionadas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Todavia no agregaste partidas. Elegi cantidades abajo.
          </p>
        ) : (
          <ul className="divide-y border rounded-md">
            {seleccionadas.map(({ partida, cantidad }) => (
              <li
                key={partida.key}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium truncate">
                    Partida {partida.numeroLote ?? 'sin numero'}
                    <span className="text-muted-foreground font-normal">
                      {' - '}
                      {partida.articuloNombre} - {partida.colorNombre}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {cantidad} {cantidad === 1 ? 'rollo solicitado' : 'rollos solicitados'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCantidad(partida, 0)}
                  className="text-xs rounded-md border px-2 py-1 hover:bg-zinc-50 text-destructive shrink-0"
                  disabled={submitPending}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitPending || totalRollos === 0 || !clienteId}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitPending ? 'Creando pedido...' : 'Crear pedido'}
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-sm">Partidas disponibles</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Partida, articulo o pieza">
            <input
              type="text"
              defaultValue={currentFilters.q}
              onBlur={(e) => {
                if (e.target.value !== currentFilters.q) updateFilter('q', e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  updateFilter('q', (e.target as HTMLInputElement).value)
                }
              }}
              placeholder="Ej. Lote 123"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Articulo">
            <select
              value={currentFilters.articulo}
              onChange={(e) => updateFilter('articulo', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-white"
            >
              <option value="">Todos</option>
              {articulos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Color">
            <SearchableCombobox
              options={colores.map((c) => ({ value: c.id, label: c.nombre }))}
              value={currentFilters.color}
              onChange={(v) => updateFilter('color', v)}
              placeholder="Todos"
              searchPlaceholder="Buscar color..."
              emptyLabel="Sin colores"
            />
          </Field>

          <Field label="Tintoreria">
            <select
              value={currentFilters.tintoreria}
              onChange={(e) => updateFilter('tintoreria', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-white"
            >
              <option value="">Todas</option>
              {tintorerias.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-1">
          <Field label="Minimo en inventario">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                defaultValue={currentFilters.diasMinimos}
                onBlur={(e) => {
                  if (e.target.value !== currentFilters.diasMinimos) {
                    updateFilter('diasMinimos', e.target.value)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    updateFilter('diasMinimos', (e.target as HTMLInputElement).value)
                  }
                }}
                placeholder="Ej. 30"
                className="w-24 rounded-md border px-3 py-2 text-sm"
              />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs">
          <p className="text-muted-foreground">
            {filtroPending
              ? 'Aplicando filtros...'
              : `${partidasDisponibles.length} partidas disponibles`}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {partidasDisponibles.length === 0 ? (
          <div className="rounded-md border bg-zinc-50 p-6 text-center text-sm text-muted-foreground">
            No hay partidas con rollos disponibles para los filtros elegidos.
          </div>
        ) : (
          <>
            <ul className="sm:hidden divide-y border rounded-md">
              {partidasDisponibles.map((p) => (
                <PartidaCard
                  key={p.key}
                  partida={p}
                  cantidad={cantidades[p.key] ?? 0}
                  onCantidad={setCantidad}
                />
              ))}
            </ul>

            <div className="hidden sm:block overflow-x-auto rounded-md border">
              <table className="w-full min-w-[840px] text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Partida</th>
                    <th className="px-3 py-2 font-medium">Articulo</th>
                    <th className="px-3 py-2 font-medium">Color</th>
                    <th className="px-3 py-2 font-medium">Tintoreria</th>
                    <th className="px-3 py-2 font-medium text-right">Disponibles</th>
                    <th className="px-3 py-2 font-medium text-right">Kg disp.</th>
                    <th className="px-3 py-2 font-medium">Cantidad pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {partidasDisponibles.map((p) => (
                    <PartidaRow
                      key={p.key}
                      partida={p}
                      cantidad={cantidades[p.key] ?? 0}
                      onCantidad={setCantidad}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
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

function PartidaCard({
  partida,
  cantidad,
  onCantidad,
}: {
  partida: PartidaDisponible
  cantidad: number
  onCantidad: (partida: PartidaDisponible, value: number) => void
}) {
  return (
    <li className="space-y-2 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">Partida {partida.numeroLote ?? 'sin numero'}</p>
          <p className="text-xs text-muted-foreground">
            {partida.articuloNombre} - {partida.colorNombre}
          </p>
          <p className="text-xs text-muted-foreground">
            {partida.rollosDisponibles} rollos - {partida.kilosDisponibles.toFixed(2)} kg
          </p>
        </div>
      </div>
      <CantidadInput partida={partida} cantidad={cantidad} onCantidad={onCantidad} />
    </li>
  )
}

function PartidaRow({
  partida,
  cantidad,
  onCantidad,
}: {
  partida: PartidaDisponible
  cantidad: number
  onCantidad: (partida: PartidaDisponible, value: number) => void
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 font-medium">{partida.numeroLote ?? '-'}</td>
      <td className="px-3 py-2">{partida.articuloNombre}</td>
      <td className="px-3 py-2">{partida.colorNombre}</td>
      <td className="px-3 py-2 text-muted-foreground">
        {partida.tintoreriaNombre ?? '-'}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {partida.rollosDisponibles}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {partida.kilosDisponibles.toFixed(2)}
      </td>
      <td className="px-3 py-2">
        <CantidadInput partida={partida} cantidad={cantidad} onCantidad={onCantidad} />
      </td>
    </tr>
  )
}

function CantidadInput({
  partida,
  cantidad,
  onCantidad,
}: {
  partida: PartidaDisponible
  cantidad: number
  onCantidad: (partida: PartidaDisponible, value: number) => void
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => onCantidad(partida, cantidad - 1)}
        disabled={cantidad <= 0}
        className="size-8 rounded-md border bg-white text-sm disabled:opacity-40"
      >
        -
      </button>
      <input
        type="number"
        min="0"
        max={partida.rollosDisponibles}
        value={cantidad || ''}
        onChange={(e) => onCantidad(partida, Number(e.target.value))}
        placeholder="0"
        className="h-8 w-16 rounded-md border px-2 text-center text-sm tabular-nums"
      />
      <button
        type="button"
        onClick={() => onCantidad(partida, cantidad + 1)}
        disabled={cantidad >= partida.rollosDisponibles}
        className="size-8 rounded-md border bg-white text-sm disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}
