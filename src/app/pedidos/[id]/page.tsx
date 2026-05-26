import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import { notFound } from 'next/navigation'
import { formatArticulos } from '@/lib/utils'
import PedidoActions from './PedidoActions'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-warning/15 text-warning' },
  en_preparacion: {
    text: 'En preparación',
    className: 'bg-primary/15 text-primary',
  },
  lista: { text: 'Lista (esperando venta)', className: 'bg-success/15 text-success' },
  confirmada_venta: {
    text: 'Venta confirmada',
    className: 'bg-primary/15 text-primary',
  },
  entregada: { text: 'Entregada', className: 'bg-zinc-100 text-zinc-700' },
  cancelada: {
    text: 'Cancelada',
    className: 'bg-destructive/15 text-destructive',
  },
}

const ESTADO_ROLLO: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-warning/15 text-warning' },
  en_stock: { text: 'En stock', className: 'bg-success/15 text-success' },
  reservado: { text: 'Reservado', className: 'bg-primary/15 text-primary' },
  entregado: { text: 'Entregado', className: 'bg-zinc-100 text-zinc-700' },
  baja: { text: 'Baja', className: 'bg-destructive/15 text-destructive' },
}

export default async function PedidoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ creado?: string }>
}) {
  const { id } = await params
  const { creado } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()
  const role = profile?.role as 'ventas' | 'admin' | undefined

  const { data: pedido } = await supabase
    .from('pedidos')
    .select(
      `
        id,
        numero_pedido,
        cliente,
        numero_remito_externo,
        estado,
        created_at
      `
    )
    .eq('id', id)
    .single()

  if (!pedido) notFound()

  const { data: prRaw } = await supabase
    .from('pedido_rollos')
    .select(
      `
        id,
        pickeado_at,
        rollos (
          id,
          numero_pieza,
          ubicacion,
          kilos,
          metros,
          estado,
          color,
          articulos ( nombre ),
          ingresos ( tintorerias ( nombre ) )
        )
      `
    )
    .eq('pedido_id', id)

  type RolloRow = {
    id: string
    pickeado_at: string | null
    rollos: {
      id: string
      numero_pieza: string
      ubicacion: string | null
      kilos: number | null
      metros: number | null
      estado: string
      color: string | null
      articulos: { nombre: string } | null
      ingresos: {
        tintorerias: { nombre: string } | null
      } | null
    } | null
  }
  const rows = (prRaw ?? []) as unknown as RolloRow[]

  const totalKilos = rows.reduce(
    (acc, r) => acc + Number(r.rollos?.kilos ?? 0),
    0
  )
  const estado =
    ESTADO_LABEL[pedido.estado] ?? ESTADO_LABEL.pendiente

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {creado === '1' && (
        <div className="rounded-lg border bg-success/10 border-success/30 px-4 py-3 text-sm text-foreground">
          ✓ Pedido creado correctamente con {rows.length}{' '}
          {rows.length === 1 ? 'rollo reservado' : 'rollos reservados'}.
        </div>
      )}

      <div>
        <BackButton href="/pedidos" label="Volver a pedidos" />
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="text-xl sm:text-2xl font-bold">
            Pedido {pedido.numero_pedido ?? '—'}
          </h1>
          <span
            className={`text-xs rounded-full px-2 py-0.5 ${estado.className}`}
          >
            {estado.text}
          </span>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 sm:p-5 shadow-sm grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Field label="Cliente" value={pedido.cliente} />
        <Field
          label="Artículo"
          value={formatArticulos(rows.map((r) => r.rollos?.articulos?.nombre))}
        />
        <Field
          label="Fecha"
          value={new Date(pedido.created_at).toLocaleDateString('es-AR')}
        />
        <Field
          label="N° Remito externo"
          value={pedido.numero_remito_externo ?? '—'}
        />
        <Field
          label="Total"
          value={`${rows.length} ${
            rows.length === 1 ? 'rollo' : 'rollos'
          } · ${totalKilos.toFixed(2)} kg`}
        />
      </div>

      {role && (
        <PedidoActions
          pedidoId={pedido.id}
          estado={pedido.estado}
          role={role}
        />
      )}

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-zinc-50">
          <h2 className="font-semibold text-sm">
            Rollos del pedido ({rows.length})
          </h2>
        </div>

        {/* Mobile */}
        <div className="sm:hidden divide-y">
          {rows.length > 0 ? (
            rows.map((r) => {
              if (!r.rollos) return null
              const er =
                ESTADO_ROLLO[r.rollos.estado] ?? ESTADO_ROLLO.reservado
              return (
                <div key={r.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        Pieza {r.rollos.numero_pieza}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.rollos.articulos?.nombre ?? '—'}
                        {r.rollos.color ? ` · ${r.rollos.color}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${er.className}`}
                    >
                      {er.text}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {r.rollos.kilos != null
                        ? `${Number(r.rollos.kilos).toFixed(2)} kg`
                        : '—'}
                    </span>
                    {r.rollos.ubicacion && (
                      <span>Ubic: {r.rollos.ubicacion}</span>
                    )}
                    {r.pickeado_at && (
                      <span className="text-success">✓ Pickeado</span>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin rollos asignados.
            </p>
          )}
        </div>

        {/* Desktop */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Pieza</th>
                <th className="px-4 py-2 font-medium">Artículo</th>
                <th className="px-4 py-2 font-medium">Color</th>
                <th className="px-4 py-2 font-medium">Kilos</th>
                <th className="px-4 py-2 font-medium">Ubicación</th>
                <th className="px-4 py-2 font-medium">Picking</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((r) => {
                  if (!r.rollos) return null
                  const er =
                    ESTADO_ROLLO[r.rollos.estado] ?? ESTADO_ROLLO.reservado
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">
                        {r.rollos.numero_pieza}
                      </td>
                      <td className="px-4 py-2">
                        {r.rollos.articulos?.nombre ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        {r.rollos.color ?? '—'}
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {r.rollos.kilos != null
                          ? Number(r.rollos.kilos).toFixed(2)
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {r.rollos.ubicacion ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {r.pickeado_at ? (
                          <span className="text-success">✓ Pickeado</span>
                        ) : (
                          <span className="text-muted-foreground">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 ${er.className}`}
                        >
                          {er.text}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Sin rollos asignados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5 truncate">{value}</p>
    </div>
  )
}
