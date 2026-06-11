'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import ClienteForm, { type VendedorOption } from './ClienteForm'
import { eliminarCliente } from './actions'

export type ClienteRow = {
  id: string
  nombre: string
  cuit_cuil: string | null
  contacto: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  condicion_pago: string | null
  categoria_precio: string | null
  estado_cliente: string | null
  vendedor_asignado: string | null
  notas: string | null
  activo: boolean
  created_at: string
  pedidos_count: number
  top_articulos: string[]
}

export default function ClientesList({
  clientes,
  vendedores,
}: {
  clientes: ClienteRow[]
  vendedores: VendedorOption[]
}) {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [showInactivos, setShowInactivos] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clientes.filter((c) => {
      if (deletedIds.has(c.id)) return false
      if (!showInactivos && !c.activo) return false
      if (!q) return true
      return (
        c.nombre.toLowerCase().includes(q) ||
        (c.cuit_cuil?.toLowerCase().includes(q) ?? false) ||
        (c.contacto?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.vendedor_asignado?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [clientes, deletedIds, search, showInactivos])

  const allExpanded =
    filtered.length > 0 && filtered.every((c) => expandedIds.has(c.id))

  function toggleOne(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setExpandedIds(allExpanded ? new Set() : new Set(filtered.map((c) => c.id)))
  }

  function handleDeleted(id: string) {
    setDeletedIds((prev) => new Set(prev).add(id))
    setExpandedIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, CUIT/CUIL, contacto o vendedor..."
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={showInactivos}
            onChange={(e) => setShowInactivos(e.target.checked)}
          />
          <span>Ver inactivos</span>
        </label>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          {showForm ? 'Cancelar' : '+ Nuevo cliente'}
        </button>
      </div>

      {showForm && (
        <ClienteForm
          vendedores={vendedores}
          onDone={() => setShowForm(false)}
        />
      )}

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b bg-zinc-50 px-4 py-3">
          <p className="text-sm font-medium text-muted-foreground">
            {filtered.length}{' '}
            {filtered.length === 1 ? 'cliente' : 'clientes'}
          </p>
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-action/40 px-3 py-1.5 text-xs font-medium text-action transition-colors hover:bg-action/5"
            >
              {allExpanded ? (
                <>
                  <ChevronDown className="size-3.5" />
                  Contraer todo
                </>
              ) : (
                <>
                  <ChevronRight className="size-3.5" />
                  Expandir todo
                </>
              )}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b bg-zinc-50 text-muted-foreground">
              <tr className="text-left">
                <th className="w-10 px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Pedidos</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    {clientes.length === deletedIds.size
                      ? 'Todavia no cargaste clientes.'
                      : 'No hay clientes con ese filtro.'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <ClienteRowItem
                    key={c.id}
                    cliente={c}
                    vendedores={vendedores}
                    expanded={expandedIds.has(c.id)}
                    onToggle={() => toggleOne(c.id)}
                    onDeleted={handleDeleted}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ClienteRowItem({
  cliente: c,
  vendedores,
  expanded,
  onToggle,
  onDeleted,
}: {
  cliente: ClienteRow
  vendedores: VendedorOption[]
  expanded: boolean
  onToggle: () => void
  onDeleted: (id: string) => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, startDelete] = useTransition()

  function handleEliminar() {
    if (!window.confirm(`Eliminar cliente "${c.nombre}"?`)) return
    startDelete(async () => {
      const res = await eliminarCliente(c.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Cliente eliminado.')
      onDeleted(c.id)
      router.refresh()
    })
  }

  const dias = diasDesde(c.created_at)

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b hover:bg-zinc-50"
      >
        <td className="w-10 px-4 py-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-zinc-100"
            aria-label={expanded ? 'Contraer cliente' : 'Expandir cliente'}
            title={expanded ? 'Contraer' : 'Expandir'}
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          <span className="font-medium">{c.nombre}</span>
          {!c.activo && (
            <span className="ml-2 text-xs text-muted-foreground">(inactivo)</span>
          )}
        </td>
        <td className="px-4 py-3">
          <EstadoClienteBadge estado={c.estado_cliente} />
        </td>
        <td className="px-4 py-3 text-right tabular-nums">{c.pedidos_count}</td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setEditing((v) => !v)
              }}
              className="rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-zinc-100"
            >
              {editing ? 'Cerrar' : 'Editar'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleEliminar()
              }}
              disabled={deleting}
              className="inline-flex size-8 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              aria-label={`Eliminar ${c.nombre}`}
              title="Eliminar"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </td>
      </tr>

      {expanded && !editing && (
        <tr className="border-b bg-zinc-50/60">
          <td colSpan={5} className="px-4 pb-4 pl-4 pr-4 pt-3 sm:pl-14">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailCard
                  title="Contacto"
                  emptyLabel="Sin datos de contacto."
                  fields={[
                    ['Contacto', c.contacto],
                    ['Email', c.email],
                    ['Teléfono', c.telefono],
                    ['Dirección', c.direccion],
                    ['CUIT/CUIL', c.cuit_cuil],
                  ]}
                />

                <DetailCard
                  title="Comercial"
                  fields={[
                    [
                      'Condición de pago',
                      c.condicion_pago
                        ? condicionPagoLabel(c.condicion_pago)
                        : null,
                    ],
                    [
                      'Categoría de precio',
                      c.categoria_precio
                        ? categoriaPrecioLabel(c.categoria_precio)
                        : null,
                    ],
                    ['Vendedor', c.vendedor_asignado],
                    ['Antigüedad', `${dias} ${dias === 1 ? 'día' : 'días'}`],
                  ]}
                />

                <ArticulosCard articulos={c.top_articulos} />
              </div>

              {c.notas && c.notas.trim() && (
                <div className="rounded-lg border bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notas
                  </p>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">
                    {c.notas}
                  </p>
                </div>
              )}

              <Link
                href={`/clientes/${c.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-action hover:underline"
              >
                Ver ficha completa e historial de pedidos →
              </Link>
            </div>
          </td>
        </tr>
      )}

      {editing && (
        <tr className="border-b bg-zinc-50/60">
          <td />
          <td colSpan={4} className="px-4 py-4">
            <ClienteForm
              cliente={{
                id: c.id,
                nombre: c.nombre,
                cuit_cuil: c.cuit_cuil,
                contacto: c.contacto,
                email: c.email,
                telefono: c.telefono,
                direccion: c.direccion,
                condicion_pago: c.condicion_pago,
                categoria_precio: c.categoria_precio,
                estado_cliente: c.estado_cliente,
                vendedor_asignado: c.vendedor_asignado,
                notas: c.notas,
              }}
              vendedores={vendedores}
              onDone={() => setEditing(false)}
            />
          </td>
        </tr>
      )}
    </>
  )
}

function DetailCard({
  title,
  fields,
  emptyLabel = 'Sin datos.',
}: {
  title: string
  fields: [string, string | null][]
  emptyLabel?: string
}) {
  const visibles = fields.filter(
    ([, value]) => value != null && value.trim() !== ''
  )
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {visibles.length > 0 ? (
        <dl className="mt-2 space-y-2">
          {visibles.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  )
}

function ArticulosCard({ articulos }: { articulos: string[] }) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Artículos más pedidos
      </p>
      {articulos.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {articulos.map((art) => (
            <li
              key={art}
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-action" />
              {art}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Sin pedidos todavía.
        </p>
      )}
    </div>
  )
}

function diasDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function condicionPagoLabel(value: string | null): string {
  switch (value) {
    case 'contado':
      return 'Contado'
    case 'cuenta_corriente':
      return 'Cuenta corriente'
    case '30_dias':
      return '30 dias'
    case '60_dias':
      return '60 dias'
    case '90_dias':
      return '90 dias'
    default:
      return 'Sin definir'
  }
}

function categoriaPrecioLabel(value: string | null): string {
  switch (value) {
    case 'minorista':
      return 'Minorista'
    case 'mayorista':
      return 'Mayorista'
    case 'precio_especial':
      return 'Precio especial'
    default:
      return 'Sin categoria'
  }
}

function EstadoClienteBadge({ estado }: { estado: string | null }) {
  const value = estado ?? 'activo'
  const config =
    value === 'potencial'
      ? { text: 'Potencial', className: 'bg-warning/15 text-warning' }
      : value === 'inactivo'
        ? { text: 'Inactivo', className: 'bg-zinc-200 text-zinc-600' }
        : { text: 'Activo', className: 'bg-success/15 text-success' }

  return (
    <span className={`text-xs rounded-full px-2 py-0.5 ${config.className}`}>
      {config.text}
    </span>
  )
}
