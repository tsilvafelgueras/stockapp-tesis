import Link from 'next/link'
import { ArrowLeft, Clock3, Search, ShoppingCart, Users, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const actions: {
  href: string
  title: string
  description: string
  icon: LucideIcon
  primary?: boolean
}[] = [
  {
    href: '/stock',
    title: 'Buscar stock',
    description: 'Filtrá por artículo, color, ubicación o tintorería.',
    icon: Search,
    primary: true,
  },
  {
    href: '/ventas/pedidos/nuevo',
    title: 'Nuevo pedido',
    description: 'Reservá rollos concretos para un cliente.',
    icon: ShoppingCart,
  },
  {
    href: '/ventas/pedidos',
    title: 'Pedidos abiertos',
    description: 'Seguí pendientes, preparación y ventas confirmadas.',
    icon: Clock3,
  },
  {
    href: '/ventas/clientes',
    title: 'Clientes',
    description: 'Consulta historial, datos de contacto y pedidos.',
    icon: Users,
  },
]

export default async function VentasDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, role')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

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

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg border p-4 shadow-sm transition-all hover:shadow-md ${
                item.primary
                  ? 'border-action bg-action text-action-foreground hover:bg-action/95'
                  : 'bg-white hover:border-action/40'
              }`}
            >
              <span
                className={`flex size-11 items-center justify-center rounded-md ${
                  item.primary ? 'bg-white/16' : 'bg-accent text-action'
                }`}
              >
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 font-heading text-lg font-semibold">{item.title}</h2>
              <p
                className={`mt-1 text-sm leading-5 ${
                  item.primary ? 'text-white/78' : 'text-muted-foreground'
                }`}
              >
                {item.description}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
