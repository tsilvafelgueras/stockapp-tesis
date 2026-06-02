import Link from 'next/link'
import { ArrowLeft, Clock3, Search, ShoppingCart, Users, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getResumenDiaPedidos } from '@/lib/resumenDiario'
import { reporteStock } from '@/app/admin/reportes/queries'
import NotificationBanner from '@/components/NotificationBanner'
import SeccionDenegadaBanner from '@/components/SeccionDenegadaBanner'

const kg = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

const actions: {
  href: string
  title: string
  description: string
  icon: LucideIcon
}[] = [
  {
    href: '/stock',
    title: 'Buscar stock',
    description: 'Filtrá por artículo, color, ubicación o tintorería.',
    icon: Search,
  },
  {
    href: '/pedidos/nuevo',
    title: 'Nuevo pedido',
    description: 'Reservá rollos concretos para un cliente.',
    icon: ShoppingCart,
  },
  {
    href: '/pedidos',
    title: 'Pedidos abiertos',
    description: 'Seguí pendientes, preparación, salidas y demoras.',
    icon: Clock3,
  },
  {
    href: '/clientes',
    title: 'Clientes',
    description: 'Consultá historial, datos de contacto y pedidos.',
    icon: Users,
  },
]

type VentasDashboardSearchParams = {
  denegado?: string
}

export default async function VentasDashboard({
  searchParams,
}: {
  searchParams: Promise<VentasDashboardSearchParams>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: profile }, resumenDia, stock] = await Promise.all([
    supabase.from('profiles').select('nombre, role').eq('id', user!.id).single(),
    getResumenDiaPedidos(supabase),
    reporteStock(supabase),
  ])

  const isAdmin = profile?.role === 'admin'
  const totalRollos = stock.reduce((acc, r) => acc + r.rollos, 0)
  const totalKilos = stock.reduce((acc, r) => acc + r.kilos, 0)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-5 sm:px-6 md:py-8">
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-border sm:p-6">
        {isAdmin && (
          <Link
            href="/admin/dashboard"
            className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Volver al panel
          </Link>
        )}
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Ventas
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Stock disponible para vender
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Bienvenida, {profile?.nombre ?? 'usuaria'}. Buscá disponibilidad real,
          reserva rollos y evita prometer mercadería que ya está comprometida.
        </p>
      </div>

      <SeccionDenegadaBanner denegado={sp.denegado} />

      <NotificationBanner />

      <section className="grid gap-3 sm:grid-cols-2">
        <DiaTile
          label="Rollos pedidos hoy"
          value={resumenDia.rollosPedidos}
          detail={`${kg(resumenDia.kilosPedidos)} kg`}
        />
        <DiaTile
          label="Rollos enviados hoy"
          value={resumenDia.rollosEnviados}
          detail={`${kg(resumenDia.kilosEnviados)} kg`}
        />
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-end justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Stock disponible
            </h2>
            <p className="text-sm text-muted-foreground">
              Rollos en stock agrupados por artículo y color.
            </p>
          </div>
          <Link
            href="/stock"
            className="shrink-0 text-sm font-medium text-action underline-offset-2 hover:underline"
          >
            Ver detalle
          </Link>
        </div>

        {stock.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay rollos en stock por ahora.
          </p>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="divide-y sm:hidden">
              {stock.map((r) => (
                <li
                  key={`${r.articulo}|||${r.color}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.articulo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.color}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm tabular-nums">
                    <p className="font-medium">{kg(r.kilos)} kg</p>
                    <p className="text-xs text-muted-foreground">
                      {r.rollos} {r.rollos === 1 ? 'rollo' : 'rollos'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: tabla */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-zinc-50 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Artículo</th>
                    <th className="px-4 py-2 font-medium">Color</th>
                    <th className="px-4 py-2 text-right font-medium">Rollos</th>
                    <th className="px-4 py-2 text-right font-medium">Kilos</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((r) => (
                    <tr
                      key={`${r.articulo}|||${r.color}`}
                      className="border-b last:border-0"
                    >
                      <td className="px-4 py-2 font-medium">{r.articulo}</td>
                      <td className="px-4 py-2">{r.color}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {r.rollos}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {kg(r.kilos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-zinc-50">
                  <tr>
                    <td className="px-4 py-2 font-semibold" colSpan={2}>
                      Total
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {totalRollos}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {kg(totalKilos)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-action/40 hover:shadow-md"
            >
              <span className="flex size-11 items-center justify-center rounded-md bg-accent text-action">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 font-heading text-lg font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {item.description}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function DiaTile({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail: string
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-heading text-3xl font-bold tabular-nums">
        {value.toLocaleString('es-AR')}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}
