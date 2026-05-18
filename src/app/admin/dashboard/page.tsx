import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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

export default async function AdminDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: profile }, alertas] = await Promise.all([
    supabase
      .from('profiles')
      .select('nombre')
      .eq('id', user!.id)
      .single(),
    getAlertasStockMinimo(supabase),
  ])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Panel de Administración</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenida, {profile?.nombre ?? 'usuaria'}
        </p>
      </div>

      {alertas.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-2">
          <p className="text-sm font-medium">
            ⚠ Stock por debajo del mínimo configurado
          </p>
          <ul className="space-y-1">
            {alertas.map((a) => (
              <li key={a.articuloId} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{a.nombre}</span>
                {' — '}
                {a.stockActualKg.toFixed(2)} kg actuales / {a.stockMinimoKg.toFixed(2)} kg mínimo
              </li>
            ))}
          </ul>
          <Link href="/stock" className="text-xs underline hover:no-underline">
            Ver stock →
          </Link>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Operación
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            href="/operario/ingresos"
            title="Ingresos"
            description="Llegadas de mercadería desde tintorerías"
          />
          <Card
            href="/stock"
            title="Stock"
            description="Ver rollos disponibles, filtrar y dar de baja"
          />
          <Card
            href="/ventas/dashboard"
            title="Pedidos"
            description="Gestión de pedidos de clientes"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Catálogos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            href="/admin/articulos"
            title="Artículos"
            description="Tipos de tela"
          />
          <Card
            href="/admin/tintorerias"
            title="Tintorerías"
            description="Proveedores de teñido"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Equipo
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            href="/admin/equipo"
            title="Usuarios"
            description="Invitar y listar usuarios de la empresa"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Análisis
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            href="/admin/reportes"
            title="Reportes"
            description="Stock, movimientos del mes, diferencias y antigüedad"
          />
        </div>
      </section>
    </div>
  )
}

function Card({
  href,
  title,
  description,
  disabled,
}: {
  href?: string
  title: string
  description: string
  disabled?: boolean
}) {
  const content = (
    <div
      className={`rounded-lg border bg-white p-5 shadow-sm transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:shadow-md hover:border-primary/30 cursor-pointer'
      }`}
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  )

  if (disabled || !href) return content
  return <Link href={href}>{content}</Link>
}
