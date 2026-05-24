'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { crearPedido } from '../actions'
import { crearCliente } from '@/app/clientes/actions'

export type Catalogo = { id: string; nombre: string }

export type RolloDisponible = {
  id: string
  numero_pieza: string
  ubicacion: string | null
  kilos: number | null
  metros: number | null
  articulos: { id: string; nombre: string } | null
  ingresos: {
    id: string
    color: string | null
    numero_lote: string | null
    tintorerias: { id: string; nombre: string } | null
  } | null
}

type Filters = {
  q: string
  articulo: string
  color: string
  tintoreria: string
}

export default function NuevoPedidoForm({
  rollosDisponibles,
  articulos,
  tintorerias,
  clientes: clientesIniciales,
  currentFilters,
}: {
  rollosDisponibles: RolloDisponible[]
  articulos: Catalogo[]
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
  const [carrito, setCarrito] = useState<RolloDisponible[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filtroPending, startFiltroTransition] = useTransition()
  const [submitPending, startSubmitTransition] = useTransition()

  const carritoIds = new Set(carrito.map((r) => r.id))
  const rollosNoEnCarrito = rollosDisponibles.filter(
    (r) => !carritoIds.has(r.id)
  )
  const totalKilos = carrito.reduce(
    (acc, r) => acc + Number(r.kilos ?? 0),
    0
  )

  // Agrupación por lote: solo cuando hay filtro de artículo activo. La idea
  // es priorizar lotes con poco stock disponible para liquidarlos antes y
  // evitar quedar con rollos huérfanos repartidos en varios lotes.
  const agruparPorLote = !!currentFilters.articulo
  const lotesOrdenados = agruparPorLote
    ? agruparRollosPorLote(rollosNoEnCarrito)
    : null

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

  function agregar(r: RolloDisponible) {
    if (carritoIds.has(r.id)) return
    setCarrito((prev) => [...prev, r])
  }

  function quitar(id: string) {
    setCarrito((prev) => prev.filter((r) => r.id !== id))
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
      setClientes((prev) => [...prev, res.cliente].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
      setClienteId(res.cliente.id)
      setNuevoCliente(false)
      setNuevoClienteNombre('')
      toast.success(`Cliente "${res.cliente.nombre}" creado.`)
    })
  }

  function handleSubmit() {
    setError(null)
    if (!clienteId) {
      setError('Elegí un cliente del catálogo (o creá uno nuevo).')
      return
    }
    if (carrito.length === 0) {
      setError('Agregá al menos un rollo al pedido.')
      return
    }
    startSubmitTransition(async () => {
      const res = await crearPedido(
        clienteId,
        remito,
        carrito.map((r) => r.id)
      )
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Pedido creado con ${carrito.length} rollos reservados.`)
      router.push(`/pedidos/${res.pedidoId}?creado=1`)
    })
  }

  const hasFilters =
    !!currentFilters.q ||
    !!currentFilters.articulo ||
    !!currentFilters.color ||
    !!currentFilters.tintoreria

  return (
    <div className="space-y-4">
      {/* Header del pedido */}
      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-sm">Datos del pedido</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
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
              <div className="flex flex-col sm:flex-row gap-2">
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
                  className="flex-1 rounded-md border px-3 py-2 text-sm"
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              N° Remito externo (Softland u otro)
            </label>
            <input
              type="text"
              value={remito}
              onChange={(e) => setRemito(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Carrito */}
      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-sm">
            Rollos seleccionados ({carrito.length})
          </h2>
          {carrito.length > 0 && (
            <span className="text-sm tabular-nums text-muted-foreground">
              Total: <strong className="text-foreground">{totalKilos.toFixed(2)} kg</strong>
            </span>
          )}
        </div>

        {carrito.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Todavía no agregaste rollos. Buscalos abajo y tocá &ldquo;Agregar&rdquo;.
          </p>
        ) : (
          <ul className="divide-y border rounded-md">
            {carrito.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium truncate">
                    Pieza {r.numero_pieza}
                    <span className="text-muted-foreground font-normal">
                      {' · '}
                      {r.articulos?.nombre ?? '—'}
                      {r.ingresos?.color ? ` · ${r.ingresos.color}` : ''}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {r.kilos != null ? `${Number(r.kilos).toFixed(2)} kg` : '—'}
                    {r.ubicacion ? ` · Ubic ${r.ubicacion}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => quitar(r.id)}
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
            disabled={submitPending || carrito.length === 0 || !clienteId}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitPending ? 'Creando pedido…' : 'Crear pedido'}
          </button>
        </div>
      </section>

      {/* Filtros + lista de disponibles */}
      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-sm">Buscar rollos disponibles</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              N° Pieza
            </label>
            <input
              type="text"
              defaultValue={currentFilters.q}
              onBlur={(e) => {
                if (e.target.value !== currentFilters.q)
                  updateFilter('q', e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  updateFilter('q', (e.target as HTMLInputElement).value)
                }
              }}
              placeholder="Ej. 12345"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Artículo
            </label>
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
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Color
            </label>
            <input
              type="text"
              defaultValue={currentFilters.color}
              onBlur={(e) => {
                if (e.target.value !== currentFilters.color)
                  updateFilter('color', e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  updateFilter('color', (e.target as HTMLInputElement).value)
                }
              }}
              placeholder="Ej. Negro"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Tintorería
            </label>
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
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs">
          <p className="text-muted-foreground">
            {filtroPending
              ? 'Aplicando filtros…'
              : `${rollosNoEnCarrito.length} rollos disponibles`}
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

        {rollosNoEnCarrito.length === 0 ? (
          <div className="rounded-md border bg-zinc-50 p-6 text-center text-sm text-muted-foreground">
            {rollosDisponibles.length === 0
              ? 'No hay rollos en stock que coincidan con los filtros.'
              : 'Todos los rollos del filtro ya están en el carrito.'}
          </div>
        ) : lotesOrdenados ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Agrupado por lote. Los lotes con menos stock disponible aparecen
              primero para liquidarlos antes y no quedar con rollos sueltos.
            </p>
            {lotesOrdenados.map((grupo, idx) => (
              <LoteGroup
                key={grupo.key}
                grupo={grupo}
                priorizar={idx === 0 && lotesOrdenados.length > 1}
                onAgregar={agregar}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="sm:hidden divide-y border rounded-md">
              {rollosNoEnCarrito.map((r) => (
                <RolloCardMobile key={r.id} r={r} onAgregar={agregar} />
              ))}
            </ul>

            {/* Desktop: tabla */}
            <div className="hidden sm:block overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Pieza</th>
                    <th className="px-3 py-2 font-medium">Artículo</th>
                    <th className="px-3 py-2 font-medium">Color</th>
                    <th className="px-3 py-2 font-medium">Kilos</th>
                    <th className="px-3 py-2 font-medium">Ubicación</th>
                    <th className="px-3 py-2 font-medium">Tintorería</th>
                    <th className="px-3 py-2 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {rollosNoEnCarrito.map((r) => (
                    <RolloRowDesktop key={r.id} r={r} onAgregar={agregar} />
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

type LoteGrupo = {
  key: string
  numero_lote: string | null
  rollos: RolloDisponible[]
  totalKilos: number
}

function agruparRollosPorLote(rollos: RolloDisponible[]): LoteGrupo[] {
  const mapa = new Map<string, LoteGrupo>()
  for (const r of rollos) {
    const numero_lote = r.ingresos?.numero_lote ?? null
    // Si un rollo no tiene lote asignado, lo agrupamos aparte bajo "sin-lote"
    // para que no rompa la UI; en la práctica todos deberían tener lote por
    // la migración 027.
    const key = numero_lote ?? '__sin_lote__'
    const existing = mapa.get(key)
    if (existing) {
      existing.rollos.push(r)
      existing.totalKilos += Number(r.kilos ?? 0)
    } else {
      mapa.set(key, {
        key,
        numero_lote,
        rollos: [r],
        totalKilos: Number(r.kilos ?? 0),
      })
    }
  }
  // Orden: stock disponible ASC (lotes casi vacíos primero), tiebreak por lote.
  const grupos = Array.from(mapa.values())
  for (const g of grupos) {
    g.rollos.sort((a, b) =>
      a.numero_pieza.localeCompare(b.numero_pieza, 'es', { numeric: true })
    )
  }
  grupos.sort((a, b) => {
    if (a.totalKilos !== b.totalKilos) return a.totalKilos - b.totalKilos
    const an = a.numero_lote ?? ''
    const bn = b.numero_lote ?? ''
    return an.localeCompare(bn, 'es')
  })
  return grupos
}

function LoteGroup({
  grupo,
  priorizar,
  onAgregar,
}: {
  grupo: LoteGrupo
  priorizar: boolean
  onAgregar: (r: RolloDisponible) => void
}) {
  const titulo = grupo.numero_lote ?? 'Sin lote asignado'
  return (
    <div
      className={`rounded-md border bg-white ${
        priorizar ? 'border-amber-300 ring-1 ring-amber-200/60' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-zinc-50 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">📦</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Lote {titulo}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {grupo.rollos.length}{' '}
              {grupo.rollos.length === 1 ? 'rollo' : 'rollos'} ·{' '}
              {grupo.totalKilos.toFixed(2)} kg disponibles
            </p>
          </div>
        </div>
        {priorizar && (
          <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
            Priorizar — menos stock
          </span>
        )}
      </div>

      {/* Mobile: cards */}
      <ul className="sm:hidden divide-y">
        {grupo.rollos.map((r) => (
          <RolloCardMobile key={r.id} r={r} onAgregar={onAgregar} />
        ))}
      </ul>

      {/* Desktop: tabla */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50/50 border-b">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Pieza</th>
              <th className="px-3 py-2 font-medium">Artículo</th>
              <th className="px-3 py-2 font-medium">Color</th>
              <th className="px-3 py-2 font-medium">Kilos</th>
              <th className="px-3 py-2 font-medium">Ubicación</th>
              <th className="px-3 py-2 font-medium">Tintorería</th>
              <th className="px-3 py-2 font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {grupo.rollos.map((r) => (
              <RolloRowDesktop key={r.id} r={r} onAgregar={onAgregar} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RolloCardMobile({
  r,
  onAgregar,
}: {
  r: RolloDisponible
  onAgregar: (r: RolloDisponible) => void
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0 text-sm">
        <p className="font-medium truncate">Pieza {r.numero_pieza}</p>
        <p className="text-xs text-muted-foreground truncate">
          {r.articulos?.nombre ?? '—'}
          {r.ingresos?.color ? ` · ${r.ingresos.color}` : ''}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {r.kilos != null ? `${Number(r.kilos).toFixed(2)} kg` : '—'}
          {r.ubicacion ? ` · ${r.ubicacion}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onAgregar(r)}
        className="text-xs rounded-md bg-primary text-primary-foreground px-3 py-1.5 hover:bg-primary/90 shrink-0"
      >
        Agregar
      </button>
    </li>
  )
}

function RolloRowDesktop({
  r,
  onAgregar,
}: {
  r: RolloDisponible
  onAgregar: (r: RolloDisponible) => void
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 font-medium">{r.numero_pieza}</td>
      <td className="px-3 py-2">{r.articulos?.nombre ?? '—'}</td>
      <td className="px-3 py-2">{r.ingresos?.color ?? '—'}</td>
      <td className="px-3 py-2 tabular-nums">
        {r.kilos != null ? Number(r.kilos).toFixed(2) : '—'}
      </td>
      <td className="px-3 py-2">{r.ubicacion ?? '—'}</td>
      <td className="px-3 py-2 text-muted-foreground">
        {r.ingresos?.tintorerias?.nombre ?? '—'}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={() => onAgregar(r)}
          className="text-xs rounded-md bg-primary text-primary-foreground px-3 py-1.5 hover:bg-primary/90"
        >
          Agregar
        </button>
      </td>
    </tr>
  )
}
