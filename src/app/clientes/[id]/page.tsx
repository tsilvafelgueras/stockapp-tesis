import Link from 'next/link'
import { notFound } from 'next/navigation'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import ClienteForm from '../ClienteForm'
import type { VendedorOption } from '../ClienteForm'
import ClienteActions from './ClienteActions'

const ESTADO_LABEL: Record<string, { text: string; className: string }> = {
  pendiente: { text: 'Pendiente', className: 'bg-warning/15 text-warning' },
  en_preparacion: {
    text: 'En preparacion',
    className: 'bg-primary/15 text-primary',
  },
  lista: { text: 'Lista', className: 'bg-success/15 text-success' },
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

type PedidoRow = {
  id: string
  numero_pedido: string | null
  estado: string
  numero_remito_externo: string | null
  numero_remito_salida: string | null
  fecha_entrega_comprometida: string | null
  created_at: string
  pedido_rollos:
    | {
        rollos:
          | {
              kilos: number | null
              color_id: string | null
              articulos: { nombre: string } | null
            }
          | null
      }[]
    | null
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

  const [{ data: pedidosRaw }, { data: colores }, { data: vendedores }] =
    await Promise.all([
      supabase
        .from('pedidos')
        .select(
          `
        id,
        numero_pedido,
        estado,
        numero_remito_externo,
        numero_remito_salida,
        fecha_entrega_comprometida,
        created_at,
        pedido_rollos (
          rollos (
            kilos,
            color_id,
            articulos ( nombre )
          )
        )
      `
        )
        .eq('cliente_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('colores').select('id, nombre'),
      supabase
        .from('profiles')
        .select('id, nombre')
        .eq('role', 'ventas')
        .order('nombre'),
    ])

  const pedidos = (pedidosRaw ?? []) as unknown as PedidoRow[]
  const colorById = new Map(
    ((colores ?? []) as { id: string; nombre: string }[]).map((c) => [
      c.id,
      c.nombre,
    ])
  )
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
    ['pendiente', 'en_preparacion', 'lista', 'confirmada_egreso'].includes(
      p.estado
    )
  ).length
  const topArticulos = calcularTopArticulos(pedidos, colorById)

  const fechaAlta = new Date(cliente.created_at).toLocaleDateString('es-AR')

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <BackButton href="/clientes" label="Volver a clientes" />
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="text-xl sm:text-2xl font-bold">{cliente.nombre}</h1>
          <span
            className={`text-xs rounded-full px-2 py-0.5 ${estadoClienteClass(
              cliente.estado_cliente
            )}`}
          >
            {estadoClienteLabel(cliente.estado_cliente)}
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Alta" value={fechaAlta} />
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

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Resumen comercial</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="CUIT/CUIL" value={cliente.cuit_cuil ?? '-'} />
          <Info
            label="Condicion de pago"
            value={condicionPagoLabel(cliente.condicion_pago)}
          />
          <Info
            label="Categoria de precio"
            value={categoriaPrecioLabel(cliente.categoria_precio)}
          />
          <Info
            label="Vendedor asignado"
            value={cliente.vendedor_asignado ?? '-'}
          />
          <Info
            label="Articulos mas pedidos"
            value={topArticulos.length > 0 ? topArticulos.join(', ') : '-'}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Datos de contacto</h2>
        <ClienteForm
          cliente={{
            id: cliente.id,
            nombre: cliente.nombre,
            cuit_cuil: cliente.cuit_cuil,
            contacto: cliente.contacto,
            email: cliente.email,
            telefono: cliente.telefono,
            direccion: cliente.direccion,
            condicion_pago: cliente.condicion_pago,
            categoria_precio: cliente.categoria_precio,
            estado_cliente: cliente.estado_cliente,
            vendedor_asignado: cliente.vendedor_asignado,
            notas: cliente.notas,
          }}
          vendedores={(vendedores ?? []) as VendedorOption[]}
        />
      </section>

      <ClienteActions clienteId={cliente.id} activo={cliente.activo} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          Historial de pedidos ({pedidos.length})
        </h2>
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-zinc-50 border-b">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Nro</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Rollos</th>
                  <th className="px-4 py-3 font-medium">Kilos</th>
                  <th className="px-4 py-3 font-medium">Remitos</th>
                  <th className="px-4 py-3 font-medium">Compromiso</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      Este cliente todavia no tiene pedidos.
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
                      <tr
                        key={p.id}
                        className="border-b last:border-0 hover:bg-zinc-50"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/pedidos/${p.id}`}
                            className="font-medium hover:underline"
                          >
                            {p.numero_pedido ?? '-'}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{cantidad}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {kilos > 0 ? `${kilos.toFixed(2)} kg` : '-'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div>{p.numero_remito_externo ?? '-'}</div>
                          {p.numero_remito_salida && (
                            <div className="text-xs">
                              Salida: {p.numero_remito_salida}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.fecha_entrega_comprometida
                            ? new Date(
                                p.fecha_entrega_comprometida
                              ).toLocaleDateString('es-AR')
                            : '-'}
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  )
}

function calcularTopArticulos(
  pedidos: PedidoRow[],
  colorById: Map<string, string>
): string[] {
  const map = new Map<string, { label: string; kilos: number; count: number }>()
  for (const p of pedidos) {
    if (p.estado === 'cancelada') continue
    for (const pr of p.pedido_rollos ?? []) {
      const articulo = pr.rollos?.articulos?.nombre
      if (!articulo) continue
      const color = pr.rollos?.color_id
        ? colorById.get(pr.rollos.color_id)
        : null
      const label = color ? `${articulo} ${color}` : articulo
      const current = map.get(label) ?? { label, kilos: 0, count: 0 }
      current.kilos += Number(pr.rollos?.kilos ?? 0)
      current.count += 1
      map.set(label, current)
    }
  }
  return Array.from(map.values())
    .sort((a, b) => {
      if (b.kilos !== a.kilos) return b.kilos - a.kilos
      return b.count - a.count
    })
    .slice(0, 3)
    .map((row) => row.label)
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

function estadoClienteLabel(value: string | null): string {
  if (value === 'potencial') return 'Potencial'
  if (value === 'inactivo') return 'Inactivo'
  return 'Activo'
}

function estadoClienteClass(value: string | null): string {
  if (value === 'potencial') return 'bg-warning/15 text-warning'
  if (value === 'inactivo') return 'bg-zinc-200 text-zinc-600'
  return 'bg-success/15 text-success'
}
