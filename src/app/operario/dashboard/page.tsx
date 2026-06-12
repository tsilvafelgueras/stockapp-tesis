import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  ClipboardCheck,
  PackageCheck,
  PackagePlus,
  Scissors,
  Search,
  Tag,
  Truck,
  type LucideIcon,
} from 'lucide-react'

const actions: {
  href: string
  title: string
  description: string
  icon: LucideIcon
}[] = [
  {
    href: '/ingresos/nuevo',
    title: 'Cargar ingreso',
    description: 'Subí la planilla o cargá los rollos a mano cuando llega mercadería.',
    icon: PackagePlus,
  },
  {
    href: '/confirmar',
    title: 'Confirmar llegadas',
    description: 'Contá los rollos que llegaron y confirmá la partida.',
    icon: PackageCheck,
  },
  {
    href: '/stock',
    title: 'Buscar stock',
    description: 'Encontrar rollos disponibles y mover ubicaciones.',
    icon: Search,
  },
  {
    href: '/picking',
    title: 'Picking',
    description: 'Preparar pedidos escaneando los rollos del depósito.',
    icon: ClipboardCheck,
  },
  {
    href: '/ingresos',
    title: 'Ver ingresos',
    description: 'Listado de llegadas cargadas, auditadas y pendientes.',
    icon: Truck,
  },
  {
    href: '/muestras',
    title: 'Muestras',
    description: 'Registrar entregas chicas que descuentan kilos del rollo.',
    icon: Scissors,
  },
  {
    href: '/rollos-sin-etiqueta',
    title: 'Etiquetado manual',
    description: 'Registrá rollos sin etiqueta y generá su QR para rotularlos.',
    icon: Tag,
  },
]

type PedidoTask = {
  id: string
  numero_pedido: string | null
  cliente: string
  estado: string
  created_at: string
}

type IngresoTask = {
  id: string
  fecha_despacho: string | null
  numero_remito: string | null
  tintorerias: { nombre: string } | null
  rollos: { id: string; estado: string }[] | null
}

export default async function OperarioDashboard() {
  const supabase = await createClient()

  const [{ data: pedidosRaw }, { data: rollosPendientes }] = await Promise.all([
    supabase
      .from('pedidos')
      .select('id, numero_pedido, cliente, estado, created_at')
      .in('estado', ['pendiente', 'en_preparacion', 'lista'])
      .order('created_at', { ascending: true })
      .limit(8),
    // Ingresos por confirmar = los que tienen al menos un rollo en estado
    // 'pendiente'. Mismo criterio que /confirmar: resolvemos primero los ids
    // de los ingresos pendientes (no alcanza con traer los más recientes y
    // filtrar, porque eso se perdía ingresos viejos sin confirmar).
    supabase.from('rollos').select('ingreso_id').eq('estado', 'pendiente'),
  ])

  const ingresoIdsPendientes = [
    ...new Set(
      ((rollosPendientes ?? []) as { ingreso_id: string }[]).map(
        (r) => r.ingreso_id
      )
    ),
  ]

  const { data: ingresosRaw } =
    ingresoIdsPendientes.length > 0
      ? await supabase
          .from('ingresos')
          .select(
            `
              id,
              fecha_despacho,
              numero_remito,
              tintorerias ( nombre ),
              rollos ( id, estado )
            `
          )
          .in('id', ingresoIdsPendientes)
          .order('fecha_despacho', { ascending: false })
          .limit(8)
      : { data: [] }

  const pedidos = ((pedidosRaw ?? []) as PedidoTask[]).filter(Boolean)
  const ingresos = ((ingresosRaw ?? []) as unknown as IngresoTask[])
    .map((i) => ({
      ...i,
      pendientes: i.rollos?.filter((r) => r.estado === 'pendiente').length ?? 0,
    }))
    .filter((i) => i.pendientes > 0)

  const pedidosPendientes = pedidos.filter((p) => p.estado !== 'lista')
  const pedidosListos = pedidos.filter((p) => p.estado === 'lista')
  // El total real de ingresos por confirmar (sin el tope de 8 del listado).
  const ingresosPendientesCount = ingresoIdsPendientes.length
  const totalTareas =
    pedidosPendientes.length + pedidosListos.length + ingresosPendientesCount

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-4 py-5 sm:px-6 md:min-h-dvh md:py-8">
      <div className="mb-5 rounded-xl bg-sidebar p-5 text-white shadow-sm sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-white/55">
          Depósito
        </p>
        <h1 className="mt-2 text-2xl font-bold">¿Qué vas a mover hoy?</h1>
      </div>

      <section className="mb-5 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Tareas de depósito</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pedidos, salidas e ingresos pendientes para organizar el día.
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              totalTareas > 0
                ? 'bg-warning/15 text-warning'
                : 'bg-success/15 text-success'
            }`}
          >
            {totalTareas > 0 ? `${totalTareas} pendientes` : 'Todo al día'}
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {pedidosPendientes.length > 0 && (
            <TaskBlock
              title="Pedidos para picking"
              href="/picking"
              count={pedidosPendientes.length}
              tone="warning"
            >
              {pedidosPendientes.slice(0, 3).map((p) => (
                <TaskLink
                  key={p.id}
                  href={`/picking/${p.id}`}
                  title={`Pedido ${p.numero_pedido ?? '-'}`}
                  detail={`${p.cliente} · ${estadoPedidoLabel(p.estado)}`}
                />
              ))}
            </TaskBlock>
          )}

          {pedidosListos.length > 0 && (
            <TaskBlock
              title="Listos para salida física"
              href="/picking"
              count={pedidosListos.length}
              tone="success"
            >
              {pedidosListos.slice(0, 3).map((p) => (
                <TaskLink
                  key={p.id}
                  href={`/picking/${p.id}`}
                  title={`Confirmar salida ${p.numero_pedido ?? '-'}`}
                  detail={p.cliente}
                />
              ))}
            </TaskBlock>
          )}

          {ingresos.length > 0 && (
            <TaskBlock
              title="Ingresos por confirmar"
              href="/confirmar"
              count={ingresosPendientesCount}
              tone="primary"
            >
              {ingresos.slice(0, 3).map((i) => (
                <TaskLink
                  key={i.id}
                  href={`/confirmar/${i.id}`}
                  title={i.tintorerias?.nombre ?? 'Ingreso sin tintorería'}
                  detail={`${i.pendientes} rollos pendientes${
                    i.numero_remito ? ` · Rem. ${i.numero_remito}` : ''
                  }`}
                />
              ))}
            </TaskBlock>
          )}

          {totalTareas === 0 && (
            <div className="rounded-lg border bg-zinc-50 px-4 py-5 text-center text-sm text-muted-foreground">
              No hay pedidos ni ingresos pendientes ahora.
            </div>
          )}
        </div>
      </section>

      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {actions.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-28 items-start gap-4 rounded-lg border bg-white p-4 text-foreground shadow-sm outline-none transition-all hover:border-action/40 hover:shadow-md focus-visible:border-action focus-visible:ring-2 focus-visible:ring-action/30 active:scale-[0.99]"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-accent text-action">
                <Icon className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-heading text-lg font-semibold">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function TaskBlock({
  title,
  href,
  count,
  tone,
  children,
}: {
  title: string
  href: string
  count: number
  tone: 'warning' | 'success' | 'primary'
  children: React.ReactNode
}) {
  const toneClass =
    tone === 'warning'
      ? 'bg-warning/15 text-warning'
      : tone === 'success'
        ? 'bg-success/15 text-success'
        : 'bg-primary/15 text-primary'

  return (
    <div className="rounded-lg border bg-zinc-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Link
          href={href}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}
        >
          {count}
        </Link>
      </div>
      <div className="mt-2 divide-y rounded-md border bg-white">{children}</div>
    </div>
  )
}

function TaskLink({
  href,
  title,
  detail,
}: {
  href: string
  title: string
  detail: string
}) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-sm transition-colors hover:bg-zinc-50"
    >
      <span className="block font-medium">{title}</span>
      <span className="block text-xs text-muted-foreground">{detail}</span>
    </Link>
  )
}

function estadoPedidoLabel(estado: string) {
  switch (estado) {
    case 'pendiente':
      return 'pendiente'
    case 'en_preparacion':
      return 'en preparación'
    case 'lista':
      return 'listo'
    default:
      return estado
  }
}
