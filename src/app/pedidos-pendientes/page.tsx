import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PedidoPendienteRow from './PedidoPendienteRow'

export default async function PedidosPendientesPage() {
  const supabase = await createClient()

  const { data: pendientes } = await supabase
    .from('pedidos_pendientes')
    .select('id, cliente, color, metros_estimados, kilos_estimados, notas, created_at, articulos(nombre)')
    .eq('estado', 'activo')
    .order('created_at', { ascending: true })

  const { data: resueltos } = await supabase
    .from('pedidos_pendientes')
    .select('id, cliente, color, metros_estimados, kilos_estimados, notas, created_at, resolved_at, estado, articulos(nombre)')
    .in('estado', ['resuelto', 'cancelado'])
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Demandas pendientes</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos de clientes sin stock asignado todavía
          </p>
        </div>
        <Link
          href="/ventas/pedidos-pendientes/nuevo"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors text-center"
        >
          + Nueva demanda
        </Link>
      </div>

      {/* Leyenda de colores */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-success"></span>
          Menos de 3 días
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-warning"></span>
          3–7 días
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-destructive"></span>
          Más de 7 días
        </span>
      </div>

      {/* Activas */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-zinc-50">
          <h2 className="font-semibold text-sm">Activas ({pendientes?.length ?? 0})</h2>
        </div>
        {pendientes && pendientes.length > 0 ? (
          <div className="divide-y">
            {pendientes.map((p) => (
              <PedidoPendienteRow key={p.id} pedido={p as unknown as PedidoPendienteData} />
            ))}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay demandas activas. ¡Bien!
          </p>
        )}
      </div>

      {/* Historial */}
      {resueltos && resueltos.length > 0 && (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-zinc-50">
            <h2 className="font-semibold text-sm text-muted-foreground">Historial reciente</h2>
          </div>
          <div className="divide-y">
            {resueltos.map((p) => (
              <PedidoPendienteRow key={p.id} pedido={p as unknown as PedidoPendienteData} readonly />
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
  color: string | null
  metros_estimados: number | null
  kilos_estimados: number | null
  notas: string | null
  created_at: string
  resolved_at?: string | null
  estado?: string
  articulos: { nombre: string } | null
}
