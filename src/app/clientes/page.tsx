import { createClient } from '@/lib/supabase/server'
import DashboardBackButton from '@/components/DashboardBackButton'
import ClientesList, { type ClienteRow } from './ClientesList'

export default async function ClientesPage() {
  const supabase = await createClient()

  const [{ data: clientes }, { data: pedidos }] = await Promise.all([
    supabase
      .from('clientes')
      .select(
        `
          id,
          nombre,
          cuit_cuil,
          contacto,
          email,
          telefono,
          direccion,
          condicion_pago,
          categoria_precio,
          estado_cliente,
          vendedor_asignado,
          notas,
          activo,
          created_at
        `
      )
      .order('nombre'),
    supabase.from('pedidos').select(
      `
        cliente_id,
        estado,
        pedido_rollos (
          rollos (
            kilos,
            articulos ( nombre ),
            colores ( nombre )
          )
        )
      `
    ),
  ])

  type PedidoClienteRow = {
    cliente_id: string | null
    estado: string
    pedido_rollos:
      | {
          rollos:
            | {
                kilos: number | null
                articulos: { nombre: string } | null
                colores: { nombre: string } | null
              }
            | null
        }[]
      | null
  }

  const pedidosRows = (pedidos ?? []) as unknown as PedidoClienteRow[]

  const countByCliente = new Map<string, number>()
  const topByCliente = new Map<string, Map<string, { label: string; kilos: number; count: number }>>()
  for (const p of pedidosRows) {
    if (!p.cliente_id) continue
    countByCliente.set(p.cliente_id, (countByCliente.get(p.cliente_id) ?? 0) + 1)
    if (p.estado === 'cancelada') continue
    const inner =
      topByCliente.get(p.cliente_id) ??
      new Map<string, { label: string; kilos: number; count: number }>()
    for (const pr of p.pedido_rollos ?? []) {
      const articulo = pr.rollos?.articulos?.nombre
      if (!articulo) continue
      const color = pr.rollos?.colores?.nombre
      const label = color ? `${articulo} ${color}` : articulo
      const current = inner.get(label) ?? { label, kilos: 0, count: 0 }
      current.kilos += Number(pr.rollos?.kilos ?? 0)
      current.count += 1
      inner.set(label, current)
    }
    topByCliente.set(p.cliente_id, inner)
  }

  const rows: ClienteRow[] = (clientes ?? []).map((c) => ({
    ...c,
    pedidos_count: countByCliente.get(c.id) ?? 0,
    top_articulos: Array.from(topByCliente.get(c.id)?.values() ?? [])
      .sort((a, b) => {
        if (b.kilos !== a.kilos) return b.kilos - a.kilos
        return b.count - a.count
      })
      .slice(0, 3)
      .map((r) => r.label),
  }))

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <DashboardBackButton />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de clientes y resumen de actividad.
        </p>
      </div>

      <ClientesList clientes={rows} />
    </div>
  )
}
