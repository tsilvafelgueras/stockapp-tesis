import Link from 'next/link'
import { ArrowLeft, Clock3, Search, ShoppingCart, Users, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import NotificationBanner from '@/components/NotificationBanner'

type ActionTone = 'action' | 'accent2' | 'plum' | 'teal'

const actions: {
  href: string
  title: string
  description: string
  icon: LucideIcon
  tone: ActionTone
}[] = [
  {
    href: '/stock',
    title: 'Buscar stock',
    description: 'Filtrá por artículo, color, ubicación o tintorería.',
    icon: Search,
    tone: 'action',
  },
  {
    href: '/pedidos/nuevo',
    title: 'Nuevo pedido',
    description: 'Reservá rollos concretos para un cliente.',
    icon: ShoppingCart,
    tone: 'accent2',
  },
  {
    href: '/pedidos',
    title: 'Pedidos abiertos',
    description: 'Seguí pendientes, preparación y ventas confirmadas.',
    icon: Clock3,
    tone: 'plum',
  },
  {
    href: '/clientes',
    title: 'Clientes',
    description: 'Consultá historial, datos de contacto y pedidos.',
    icon: Users,
    tone: 'teal',
  },
]

const ACTION_TONE_STYLES: Record<
  ActionTone,
  { hoverBorder: string; bg: string }
> = {
  action: { hoverBorder: 'hover:border-action/40', bg: 'bg-action/10 text-action' },
  accent2: { hoverBorder: 'hover:border-accent2/40', bg: 'bg-accent2-soft text-accent2' },
  plum: { hoverBorder: 'hover:border-brand-plum/40', bg: 'bg-brand-plum/10 text-brand-plum' },
  teal: { hoverBorder: 'hover:border-brand-teal/40', bg: 'bg-brand-teal/12 text-brand-teal' },
}

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
      <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-border sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent2-soft blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-action/10 blur-2xl"
        />
        <div className="relative">
          {isAdmin && (
            <Link
              href="/admin/dashboard"
              className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Volver al panel
            </Link>
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent2">
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
      </div>

      <NotificationBanner />

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((item) => {
          const Icon = item.icon
          const styles = ACTION_TONE_STYLES[item.tone]
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg border bg-white p-4 shadow-sm transition-all ${styles.hoverBorder} hover:shadow-md`}
            >
              <span className={`flex size-11 items-center justify-center rounded-md ${styles.bg}`}>
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
