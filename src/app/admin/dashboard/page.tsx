import Link from 'next/link'
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Factory,
  PackagePlus,
  Search,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

type AlertaStockMinimo = {
  articuloId: string
  nombre: string
  stockActualKg: number
  stockMinimoKg: number
}

async function getAlertasStockMinimo(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<AlertaStockMinimo[]> {
  const [{ data: articulos }, { data: rollos }] = await Promise.all([
    supabase
      .from('articulos')
      .select('id, nombre, stock_minimo_kg')
      .not('stock_minimo_kg', 'is', null)
      .eq('activo', true),
    supabase
      .from('rollos')
      .select('articulo_id, kilos')
      .eq('estado', 'en_stock'),
  ])

  if (!articulos?.length) return []

  const stockMap = new Map<string, number>()
  for (const r of rollos ?? []) {
    const prev = stockMap.get(r.articulo_id) ?? 0
    stockMap.set(r.articulo_id, prev + Number(r.kilos ?? 0))
  }

  return articulos
    .filter((a) => {
      const actual = stockMap.get(a.id) ?? 0
      return actual < Number(a.stock_minimo_kg)
    })
    .map((a) => ({
      articuloId: a.id,
      nombre: a.nombre,
      stockActualKg: stockMap.get(a.id) ?? 0,
      stockMinimoKg: Number(a.stock_minimo_kg),
    }))
}

const cards: {
  href: string
  title: string
  description: string
  icon: LucideIcon
  section: string
}[] = [
  {
    href: '/operario/ingresos',
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
    href: '/operario/picking',
    title: 'Picking',
    description: 'Preparación de pedidos con scanner QR.',
    icon: ClipboardCheck,
    section: 'Operación',
  },
  {
    href: '/ventas/pedidos',
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
    description: 'Movimientos, diferencias, antiguedad y CSV.',
    icon: BarChart3,
    section: 'Análisis',
  },
]

export default async function AdminDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: profile }, alertas, { count: rollosEnStock }, { count: pendientes }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('nombre')
        .eq('id', user!.id)
        .single(),
      getAlertasStockMinimo(supabase),
      supabase
        .from('rollos')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'en_stock'),
      supabase
        .from('rollos')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pendiente'),
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
              Buen dia, {profile?.nombre ?? 'equipo'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/68">
              Una vista rapida para entender que hay en deposito, que falta
              verificar y donde conviene actuar primero.
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

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Rollos en stock" value={rollosEnStock ?? 0} />
        <Metric label="Pendientes de verificar" value={pendientes ?? 0} />
        <Metric label="Alertas de stock" value={alertas.length} tone="warning" />
      </section>

      {alertas.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Stock por debajo del minimo configurado
              </p>
              <ul className="mt-2 space-y-1">
                {alertas.map((a) => (
                  <li key={a.articuloId} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{a.nombre}</span>
                    {' - '}
                    {a.stockActualKg.toFixed(2)} kg actuales /{' '}
                    {a.stockMinimoKg.toFixed(2)} kg minimo
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'warning'
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 font-heading text-3xl font-bold tabular-nums ${
          tone === 'warning' ? 'text-warning' : 'text-foreground'
        }`}
      >
        {value.toLocaleString('es-AR')}
      </p>
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
