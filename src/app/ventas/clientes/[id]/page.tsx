import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ClienteForm from '../ClienteForm'
import ClienteActions from './ClienteActions'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-warning/15 text-warning' },
  en_preparacion: {
    text: 'En preparación',
    className: 'bg-primary/15 text-primary',
  },
  lista: { text: 'Lista', className: 'bg-success/15 text-success' },
  confirmada_venta: {
    text: 'Venta confirmada',
    className: 'bg-primary/15 text-primary',
  },
  entregada: { text: 'Entregada', className: 'bg-zinc-100 text-zinc-700' },
  cancelada: { text: 'Cancelada', className: 'bg-destructive/15 text-destructive' },
}

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()

  if (!cliente) notFound()

  const { data: pedidosRaw } = await supabase
    .from('pedidos')
    .select(
      `
        id,
        numero_pedido,
        estado,
        numero_remito_externo,
        created_at,
        pedido_rollos ( rollos ( kilos ) )
      `
    )
    .eq('cliente_id', id)
    .order('created_at', { ascending: false })

  type PedidoRow = {
    id: string
    numero_pedido: string | null
    estado: string
    numero_remito_externo: string | null
    created_at: string
    pedido_rollos:
      | { rollos: { kilos: number | null } | null }[]
      | null
  }
  const pedidos = (pedidosRaw ?? []) as unknown as PedidoRow[]

  // Totales (excluyendo cancelados)
  const totalKilos = pedidos
    .filter((p) => p.estado !== 'cancelada')
    .reduce(
      (acc, p) =>
        acc +
        (p.pedido_rollos?.reduce(
          (a, pr) => a + Number(pr.rollos?.kilos ?? 0),
          0
        ) ?? 0),
      0
    )
  const entregados = pedidos.filter((p) => p.estado === 'entregada').length
  const enCurso = pedidos.filter((p) =>
    ['pendiente', 'en_preparacion', 'lista', 'confirmada_venta'].includes(
      p.estado
    )
  ).length

  const dias = Math.max(
    0,
    Math.floor((Date.now() - new Date(cliente.created_at).getTime()) / 86_400_000)
  )

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <BackButton href="/ventas/clientes" label="Volver a clientes" />
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="text-xl sm:text-2xl font-bold">{cliente.nombre}</h1>
          <span
            className={`text-xs rounded-full px-2 py-0.5 ${
              cliente.activo
                ? 'bg-success/15 text-success'
                : 'bg-zinc-200 text-zinc-600'
            }`}
          >
            {cliente.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Antigüedad" value={`${dias} ${dias === 1 ? 'día' : 'días'}`} />
        <Stat label="Pedidos totales" value={String(pedidos.length)} />
        <Stat label="Entregados" value={String(entregados)} />
        <Stat label="En curso" value={String(enCurso)} />
      </div>
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Kilos totales (entregados + en curso)
        </p>
        <p className="text-2xl font-bold mt-1 tabular-nums">
          {totalKilos.toLocaleString('es-AR', {
            maximumFractionDigits: 2,
          })}{' '}
          kg
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Datos de contacto</h2>
        <ClienteForm
          cliente={{
            id: cliente.id,
            nombre: cliente.nombre,
            contacto: cliente.contacto,
            email: cliente.email,
            telefono: cliente.telefono,
            direccion: cliente.direccion,
            notas: cliente.notas,
          }}
        />
      </section>

      <ClienteActions clienteId={cliente.id} activo={cliente.activo} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          Historial de pedidos ({pedidos.length})
        </h2>
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Rollos</th>
                  <th className="px-4 py-3 font-medium">Kilos</th>
                  <th className="px-4 py-3 font-medium">Remito</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      Este cliente todavía no tiene pedidos.
                    </td>
                  </tr>
                ) : (
                  pedidos.map((p) => {
                    const cantidad = p.pedido_rollos?.length ?? 0
                    const kilos =
                      p.pedido_rollos?.reduce(
                        (acc, pr) => acc + Number(pr.rollos?.kilos ?? 0),
                        0
                      ) ?? 0
                    const estado =
                      ESTADO_LABEL[p.estado] ?? ESTADO_LABEL.pendiente
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/ventas/pedidos/${p.id}`}
                            className="font-medium hover:underline"
                          >
                            {p.numero_pedido ?? '—'}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{cantidad}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {kilos > 0 ? `${kilos.toFixed(2)} kg` : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.numero_remito_externo ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs rounded-full px-2 py-0.5 ${estado.className}`}
                          >
                            {estado.text}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  )
}
