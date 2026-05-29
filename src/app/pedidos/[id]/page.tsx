import { notFound } from 'next/navigation'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import { formatArticulos } from '@/lib/utils'
import PedidoActions from './PedidoActions'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-warning/15 text-warning' },
  en_preparacion: {
    text: 'En preparacion',
    className: 'bg-primary/15 text-primary',
  },
  lista: {
    text: 'Lista (esperando salida)',
    className: 'bg-success/15 text-success',
  },
  confirmada_egreso: {
    text: 'Salida confirmada',
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
  segunda: { text: 'Segunda', className: 'bg-amber-100 text-amber-700' },
}

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
    color_id: string | null
    articulos: { nombre: string } | null
    colores: { nombre: string } | null
    ingresos: {
      tintorerias: { nombre: string } | null
    } | null
  } | null
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
        numero_remito_salida,
        fecha_entrega_comprometida,
        salida_comentario,
        confirmada_egreso_at,
        estado,
        caida_motivo,
        caida_comentario,
        caida_at,
        created_at
      `
    )
    .eq('id', id)
    .single()

  if (!pedido) notFound()

  const [{ data: prRaw }, { data: coloresRaw }] = await Promise.all([
    supabase
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
            color_id,
            articulos ( nombre ),
            ingresos ( tintorerias ( nombre ) )
          )
        `
      )
      .eq('pedido_id', id),
    supabase.from('colores').select('id, nombre'),
  ])

  const colorById = new Map(
    ((coloresRaw ?? []) as { id: string; nombre: string }[]).map((c) => [
      c.id,
      c,
    ])
  )
  const rows = ((prRaw ?? []) as unknown as RolloRow[]).map((row) => ({
    ...row,
    rollos: row.rollos
      ? {
          ...row.rollos,
          colores: row.rollos.color_id
            ? colorById.get(row.rollos.color_id) ?? null
            : null,
        }
      : null,
  }))
  const totalKilos = rows.reduce(
    (acc, r) => acc + Number(r.rollos?.kilos ?? 0),
    0
  )
  const estado = ESTADO_LABEL[pedido.estado] ?? ESTADO_LABEL.pendiente
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const demorado =
    !!pedido.fecha_entrega_comprometida &&
    ['pendiente', 'en_preparacion', 'lista'].includes(pedido.estado) &&
    pedido.fecha_entrega_comprometida < hoy.toISOString().slice(0, 10)

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {creado === '1' && (
        <div className="rounded-lg border bg-success/10 border-success/30 px-4 py-3 text-sm text-foreground">
          Pedido creado correctamente con {rows.length}{' '}
          {rows.length === 1 ? 'rollo reservado' : 'rollos reservados'}.
        </div>
      )}

      <div>
        <BackButton href="/pedidos" label="Volver a pedidos" />
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="text-xl sm:text-2xl font-bold">
            Pedido {pedido.numero_pedido ?? '-'}
          </h1>
          <span
            className={`text-xs rounded-full px-2 py-0.5 ${estado.className}`}
          >
            {estado.text}
          </span>
          {demorado && (
            <span className="text-xs rounded-full px-2 py-0.5 bg-destructive/15 text-destructive">
              Demorado
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 sm:p-5 shadow-sm grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Field label="Cliente" value={pedido.cliente} />
        <Field
          label="Articulo"
          value={formatArticulos(rows.map((r) => r.rollos?.articulos?.nombre))}
        />
        <Field
          label="Fecha"
          value={new Date(pedido.created_at).toLocaleDateString('es-AR')}
        />
        <Field
          label="Compromiso"
          value={
            pedido.fecha_entrega_comprometida
              ? new Date(
                  pedido.fecha_entrega_comprometida
                ).toLocaleDateString('es-AR')
              : '-'
          }
        />
        <Field
          label="Remito externo"
          value={pedido.numero_remito_externo ?? '-'}
        />
        <Field
          label="Remito salida"
          value={pedido.numero_remito_salida ?? '-'}
        />
        <Field
          label="Total"
          value={`${rows.length} ${
            rows.length === 1 ? 'rollo' : 'rollos'
          } - ${totalKilos.toFixed(2)} kg`}
        />
        <Field
          label="Salida confirmada"
          value={
            pedido.confirmada_egreso_at
              ? new Date(pedido.confirmada_egreso_at).toLocaleString('es-AR')
              : '-'
          }
        />
      </div>

      {pedido.salida_comentario && (
        <Note title="Comentario de salida" text={pedido.salida_comentario} />
      )}
      {pedido.estado === 'cancelada' && (
        <Note
          title="Caida del pedido"
          text={[
            pedido.caida_motivo ? motivoCaidaLabel(pedido.caida_motivo) : null,
            pedido.caida_comentario,
            pedido.caida_at
              ? `Registrada el ${new Date(pedido.caida_at).toLocaleString(
                  'es-AR'
                )}`
              : null,
          ]
            .filter(Boolean)
            .join(' - ')}
        />
      )}

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
                        {r.rollos.articulos?.nombre ?? '-'}
                        {r.rollos.colores?.nombre
                          ? ` - ${r.rollos.colores.nombre}`
                          : ''}
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
                        : '-'}
                    </span>
                    {r.rollos.ubicacion && (
                      <span>Ubic: {r.rollos.ubicacion}</span>
                    )}
                    {r.pickeado_at && (
                      <span className="text-success">Pickeado</span>
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

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Pieza</th>
                <th className="px-4 py-2 font-medium">Articulo</th>
                <th className="px-4 py-2 font-medium">Color</th>
                <th className="px-4 py-2 font-medium">Kilos</th>
                <th className="px-4 py-2 font-medium">Ubicacion</th>
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
                        {r.rollos.articulos?.nombre ?? '-'}
                      </td>
                      <td className="px-4 py-2">
                        {r.rollos.colores?.nombre ?? '-'}
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {r.rollos.kilos != null
                          ? Number(r.rollos.kilos).toFixed(2)
                          : '-'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {r.rollos.ubicacion ?? '-'}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {r.pickeado_at ? (
                          <span className="text-success">Pickeado</span>
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

function Note({ title, text }: { title: string; text: string }) {
  if (!text) return null
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
        {text}
      </p>
    </div>
  )
}

function motivoCaidaLabel(value: string): string {
  switch (value) {
    case 'cliente_cancelo':
      return 'Cliente cancelo'
    case 'precio':
      return 'Precio'
    case 'otro_proveedor':
      return 'Se fue con otro proveedor'
    case 'sin_respuesta':
      return 'Sin respuesta'
    case 'otro':
      return 'Otro'
    default:
      return value
  }
}
