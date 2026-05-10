import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-warning/15 text-warning' },
  en_preparacion: {
    text: 'En preparación',
    className: 'bg-primary/15 text-primary',
  },
}

export default async function PickingListPage() {
  const supabase = await createClient()

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(
      `
        id,
        numero_pedido,
        cliente,
        estado,
        created_at,
        pedido_rollos ( id, pickeado_at )
      `
    )
    .in('estado', ['pendiente', 'en_preparacion'])
    .order('created_at', { ascending: true })

  type Row = {
    id: string
    numero_pedido: string | null
    cliente: string
    estado: string
    created_at: string
    pedido_rollos:
      | { id: string; pickeado_at: string | null }[]
      | null
  }
  const rows = (pedidos ?? []) as unknown as Row[]

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Picking</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pedidos a preparar. Escaneá los rollos en el depósito.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center space-y-2 shadow-sm">
          <p className="text-2xl">✓</p>
          <p className="font-medium">Todo al día</p>
          <p className="text-sm text-muted-foreground">
            No hay pedidos esperando picking.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => {
            const estado =
              ESTADO_LABEL[p.estado] ?? ESTADO_LABEL.pendiente
            const total = p.pedido_rollos?.length ?? 0
            const pickeados =
              p.pedido_rollos?.filter((pr) => pr.pickeado_at != null)
                .length ?? 0
            const pct =
              total > 0 ? Math.round((pickeados / total) * 100) : 0
            return (
              <Link
                key={p.id}
                href={`/operario/picking/${p.id}`}
                className="block rounded-lg border bg-white p-4 shadow-sm hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.cliente}</p>
                    <p className="text-xs text-muted-foreground">
                      Pedido {p.numero_pedido ?? '—'} ·{' '}
                      {new Date(p.created_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${estado.className}`}
                  >
                    {estado.text}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    {pickeados} de {total} rollos pickeados
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="mt-1 w-full bg-zinc-100 rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
