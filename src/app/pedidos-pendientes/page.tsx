import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PedidoPendienteRow from './PedidoPendienteRow'

export default async function PedidosPendientesPage() {
  const supabase = await createClient()

  const select = `
    id,
    cliente,
    cliente_id,
    articulo_id,
    color,
    color_id,
    tipo_demanda,
    prioridad,
    fecha_requerida,
    metros_estimados,
    kilos_estimados,
    notas,
    created_at,
    resolved_at,
    estado,
    articulos(nombre),
    colores(nombre)
  `

  const { data: pendientesRaw } = await supabase
    .from('pedidos_pendientes')
    .select(select)
    .eq('estado', 'activo')
    .order('created_at', { ascending: true })

  const { data: resueltos } = await supabase
    .from('pedidos_pendientes')
    .select(select)
    .in('estado', ['resuelto', 'cancelado'])
    .order('created_at', { ascending: false })
    .limit(20)

  const pendientes = conContadorRepetidos(
    (pendientesRaw ?? []) as unknown as PedidoPendienteData[]
  )

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Demandas</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos a producir y demandas sin stock, clasificadas por prioridad.
          </p>
        </div>
        <Link
          href="/pedidos-pendientes/nuevo"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors text-center"
        >
          + Nueva demanda
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-success" />
          Menos de 3 dias
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-warning" />
          3 a 7 dias
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-destructive" />
          Mas de 7 dias
        </span>
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-zinc-50">
          <h2 className="font-semibold text-sm">
            Activas ({pendientes.length})
          </h2>
        </div>
        {pendientes.length > 0 ? (
          <div className="divide-y">
            {pendientes.map((p) => (
              <PedidoPendienteRow key={p.id} pedido={p} />
            ))}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay demandas activas.
          </p>
        )}
      </div>

      {resueltos && resueltos.length > 0 && (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-zinc-50">
            <h2 className="font-semibold text-sm text-muted-foreground">
              Historial reciente
            </h2>
          </div>
          <div className="divide-y">
            {resueltos.map((p) => (
              <PedidoPendienteRow
                key={p.id}
                pedido={p as unknown as PedidoPendienteData}
                readonly
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export type PedidoPendienteData = {
  id: string
  cliente: string
  cliente_id: string | null
  articulo_id: string | null
  color: string | null
  color_id: string | null
  tipo_demanda: string
  prioridad: string
  fecha_requerida: string | null
  metros_estimados: number | null
  kilos_estimados: number | null
  notas: string | null
  created_at: string
  resolved_at?: string | null
  estado?: string
  articulos: { nombre: string } | null
  colores: { nombre: string } | null
  repetidos_count?: number
}

function conContadorRepetidos(rows: PedidoPendienteData[]): PedidoPendienteData[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = demandaKey(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return rows.map((row) => ({
    ...row,
    repetidos_count: counts.get(demandaKey(row)) ?? 1,
  }))
}

function demandaKey(row: PedidoPendienteData): string {
  return [
    row.tipo_demanda,
    row.articulo_id ?? row.articulos?.nombre ?? '',
    row.color_id ?? row.color ?? row.colores?.nombre ?? '',
  ]
    .join('|')
    .toLowerCase()
}
