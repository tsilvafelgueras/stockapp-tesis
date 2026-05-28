'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
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
  const router = useRouter()
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [showInactivos, setShowInactivos] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeleting, startDelete] = useTransition()

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

  function handleEliminar(cliente: ClienteRow) {
    if (!window.confirm(`Eliminar cliente "${cliente.nombre}"?`)) return
    setPendingDeleteId(cliente.id)
    startDelete(async () => {
      const res = await eliminarCliente(cliente.id)
      setPendingDeleteId(null)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setDeletedIds((prev) => new Set(prev).add(cliente.id))
      toast.success('Cliente eliminado.')
      router.refresh()
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

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Pago / precio</th>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium">Mas pedidos</th>
                <th className="px-4 py-3 font-medium">Pedidos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    {clientes.length === deletedIds.size
                      ? 'Todavia no cargaste clientes.'
                      : 'No hay clientes con ese filtro.'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const dias = diasDesde(c.created_at)
                  return (
                    <tr
                      key={c.id}
                      className="border-b last:border-0 hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/clientes/${c.id}`}
                          className="font-medium hover:underline"
                        >
                          {c.nombre}
                        </Link>
                        {c.direccion && (
                          <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                            {c.direccion}
                          </p>
                        )}
                        {c.cuit_cuil && (
                          <p className="text-xs text-muted-foreground">
                            CUIT/CUIL {c.cuit_cuil}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{c.contacto ?? '-'}</div>
                        <div>{c.email ?? '-'}</div>
                        <div>{c.telefono ?? '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{condicionPagoLabel(c.condicion_pago)}</div>
                        <div>{categoriaPrecioLabel(c.categoria_precio)}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.vendedor_asignado ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.top_articulos.length > 0
                          ? c.top_articulos.join(', ')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {c.pedidos_count}
                      </td>
                      <td className="px-4 py-3">
                        <EstadoClienteBadge estado={c.estado_cliente} />
                        <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                          {dias} {dias === 1 ? 'dia' : 'dias'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleEliminar(c)}
                          disabled={isDeleting && pendingDeleteId === c.id}
                          className="inline-flex size-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          aria-label={`Eliminar ${c.nombre}`}
                          title="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
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
