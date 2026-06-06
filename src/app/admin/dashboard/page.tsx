import Link from 'next/link'
import {
  BarChart3,
  Boxes,
  Factory,
  PackagePlus,
  Search,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getResumenDiaPedidos } from '@/lib/resumenDiario'
import NotificationBanner from '@/components/NotificationBanner'
import SeccionDenegadaBanner from '@/components/SeccionDenegadaBanner'

type AlertaStockMinimo = {
  articuloId: string
  colorId: string
  nombre: string
  stockActualKg: number
  stockMinimoKg: number
}

type ResumenDiario = {
  ingresosRollos: number
  ingresosKilos: number
  pedidosCreados: number
  pedidosEntregados: number
  pedidosActivos: number
}

async function getAlertasStockMinimo(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<AlertaStockMinimo[]> {
  const [{ data: minimos }, { data: rollos }] = await Promise.all([
    supabase.from('articulo_colores').select(`
      articulo_id,
      color_id,
      stock_minimo_kg,
      articulos!inner(nombre),
      colores(nombre)
    `)
      .not('stock_minimo_kg', 'is', null)
      .eq('articulos.activo', true),
    supabase
      .from('rollos')
      .select('articulo_id, color_id, kilos')
      .eq('estado', 'en_stock'),
  ])

  if (!minimos?.length) return []

  const stockMap = new Map<string, number>()
  for (const r of rollos ?? []) {
    const key = `${r.articulo_id}|${r.color_id}`
    const prev = stockMap.get(key) ?? 0
    stockMap.set(key, prev + Number(r.kilos ?? 0))
  }

  type MinimoRow = {
    articulo_id: string
    color_id: string
    stock_minimo_kg: number | null
    articulos: { nombre: string } | null
    colores: { nombre: string } | null
  }

  return ((minimos ?? []) as unknown as MinimoRow[])
    .filter((m) => {
      const actual = stockMap.get(`${m.articulo_id}|${m.color_id}`) ?? 0
      return actual < Number(m.stock_minimo_kg)
    })
    .map((m) => {
      const key = `${m.articulo_id}|${m.color_id}`
      const articulo = m.articulos?.nombre ?? 'Articulo'
      const color = m.colores?.nombre ?? 'Sin color'
      return {
        articuloId: m.articulo_id,
        colorId: m.color_id,
        nombre: `${articulo} - ${color}`,
        stockActualKg: stockMap.get(key) ?? 0,
        stockMinimoKg: Number(m.stock_minimo_kg),
      }
    })
}

async function getResumenDiario(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ResumenDiario> {
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 1)
  const desde = inicio.toISOString()
  const hasta = fin.toISOString()

  const [
    { data: rollosHoy },
    { count: pedidosCreados },
    { count: pedidosEgresados },
    { count: pedidosActivos },
  ] = await Promise.all([
    supabase
      .from('rollos')
      .select('kilos')
      .gte('created_at', desde)
      .lt('created_at', hasta),
    supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', desde)
      .lt('created_at', hasta),
    supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .gte('confirmada_egreso_at', desde)
      .lt('confirmada_egreso_at', hasta),
    supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'en_preparacion', 'lista']),
  ])

  return {
    ingresosRollos: rollosHoy?.length ?? 0,
    ingresosKilos:
      rollosHoy?.reduce((acc, r) => acc + Number(r.kilos ?? 0), 0) ?? 0,
    pedidosCreados: pedidosCreados ?? 0,
    pedidosEntregados: pedidosEgresados ?? 0,
    pedidosActivos: pedidosActivos ?? 0,
  }
}

const cards: {
  href: string
  title: string
  description: string
  icon: LucideIcon
  section: string
}[] = [
  {
    href: '/ingresos',
    title: 'Ingresos',
    description: 'Llegadas desde tintorerías, planillas y rollos pendientes.',
    icon: PackagePlus,
    section: 'Operación',
  },
  {
    href: '/stock',
    title: 'Inventario',
    description: 'Stock disponible, ubicaciones, reservas y bajas.',
    icon: Search,
    section: 'Operación',
  },
  {
    href: '/pedidos',
    title: 'Pedidos',
    description: 'Reservas, preparación y confirmación de ventas.',
    icon: ShoppingCart,
    section: 'Ventas',
  },
  {
    href: '/admin/articulos',
    title: 'Artículos',
    description: 'Catálogo de telas y stock mínimo por artículo.',
    icon: Boxes,
    section: 'Administración',
  },
  {
    href: '/admin/tintorerias',
    title: 'Tintorerías',
    description: 'Proveedores externos de teñido y acabado.',
    icon: Factory,
    section: 'Administración',
  },
  {
    href: '/admin/equipo',
    title: 'Equipo',
    description: 'Usuarios, roles e invitaciones de la empresa.',
    icon: Users,
    section: 'Administración',
  },
  {
    href: '/admin/reportes',
    title: 'Reportes',
    description: 'Movimientos, diferencias, días en mano y CSV.',
    icon: BarChart3,
    section: 'Análisis',
  },
]

type AdminDashboardSearchParams = {
  denegado?: string
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<AdminDashboardSearchParams>
}) {
  const sp = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: profile },
    alertas,
    resumenDiario,
    { count: rollosEnStock },
    resumenDia,
  ] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('nombre')
        .eq('id', user!.id)
        .single(),
      getAlertasStockMinimo(supabase),
      getResumenDiario(supabase),
      supabase
        .from('rollos')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'en_stock'),
      getResumenDiaPedidos(supabase),
    ])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 md:py-8">
      <section className="rounded-xl bg-sidebar p-5 text-white shadow-sm sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-white/55">
          Dashboard de control
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Buen día, {profile?.nombre ?? 'equipo'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/68">
              Una vista rápida para entender que hay en deposito, qué falta
              verificar y dónde conviene actuar primero.
            </p>
          </div>
          <Link
            href="/stock"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-action px-4 text-sm font-semibold text-action-foreground transition-colors hover:bg-action/90"
          >
            Ver inventario
          </Link>
        </div>
      </section>

      <SeccionDenegadaBanner denegado={sp.denegado} />

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Resumen de hoy
            </h2>
            <p className="text-sm text-muted-foreground">
              Estado del depósito y actividad registrada durante el día.
            </p>
          </div>
          <Link
            href="/admin/reportes"
            className="text-sm font-medium text-action underline-offset-2 hover:underline"
          >
            Ver reportes
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryTile
            label="Rollos en stock"
            value={rollosEnStock ?? 0}
            detail="Disponibles en depósito"
          />
          <SummaryTile
            label="Alertas de stock"
            value={alertas.length}
            detail="Artículos bajo el mínimo"
            tone={alertas.length > 0 ? 'warning' : undefined}
          />
          <SummaryTile
            label="Ingresos"
            value={resumenDiario.ingresosRollos}
            detail={`${resumenDiario.ingresosKilos.toLocaleString('es-AR', {
              maximumFractionDigits: 2,
            })} kg`}
          />
          <SummaryTile
            label="Pedidos creados"
            value={resumenDiario.pedidosCreados}
            detail={`${resumenDiario.pedidosEntregados} egresados hoy`}
          />
          <SummaryTile
            label="Rollos pedidos"
            value={resumenDia.rollosPedidos}
            detail="Kilos reales al pickear"
          />
          <SummaryTile
            label="Rollos enviados"
            value={resumenDia.rollosEnviados}
            detail={`${resumenDia.kilosEnviados.toLocaleString('es-AR', {
              maximumFractionDigits: 2,
            })} kg`}
          />
          <SummaryTile
            label="Pedidos activos"
            value={resumenDiario.pedidosActivos}
            detail="Pendientes, en preparación o listos"
          />
        </div>
      </section>

      <NotificationBanner />

      {['Operación', 'Ventas', 'Administración', 'Análisis'].map((section) => (
        <section key={section} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {section}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards
              .filter((card) => card.section === section)
              .map((card) => (
                <DashboardCard key={card.href} {...card} />
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function SummaryTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: number
  detail: string
  tone?: 'warning'
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/35 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 font-heading text-2xl font-bold tabular-nums ${
          tone === 'warning' ? 'text-warning' : ''
        }`}
      >
        {value.toLocaleString('es-AR')}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function DashboardCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-action/40 hover:shadow-md"
    >
      <span className="flex size-11 items-center justify-center rounded-md bg-accent text-action">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-heading text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
    </Link>
  )
}
