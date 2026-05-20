import Link from 'next/link'
import {
  ClipboardCheck,
  PackagePlus,
  ScanLine,
  Scissors,
  Search,
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
    href: '/operario/ingresos/nuevo',
    title: 'Cargar ingreso',
    description: 'Subí la planilla o cargá los rollos a mano cuando llega mercadería.',
    icon: PackagePlus,
  },
  {
    href: '/operario/confirmar',
    title: 'Escanear llegadas',
    description: 'Confirmar rollos pendientes y asignarles ubicación.',
    icon: ScanLine,
  },
  {
    href: '/stock',
    title: 'Buscar stock',
    description: 'Encontrar rollos disponibles y mover ubicaciones.',
    icon: Search,
  },
  {
    href: '/operario/picking',
    title: 'Picking',
    description: 'Preparar pedidos escaneando los rollos del depósito.',
    icon: ClipboardCheck,
  },
  {
    href: '/operario/ingresos',
    title: 'Ver ingresos',
    description: 'Listado de llegadas cargadas, auditadas y pendientes.',
    icon: Truck,
  },
  {
    href: '/operario/muestras',
    title: 'Muestras',
    description: 'Registrar entregas chicas que descuentan kilos del rollo.',
    icon: Scissors,
  },
]

export default function OperarioDashboard() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-4 py-5 sm:px-6 md:min-h-dvh md:py-8">
      <div className="mb-5 rounded-xl bg-sidebar p-5 text-white shadow-sm sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-white/55">
          Deposito
        </p>
        <h1 className="mt-2 text-2xl font-bold">¿Qué vas a mover hoy?</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/68">
          Accesos grandes para trabajar rápido desde el celular, incluso con
          guantes o en pasillos con poca luz.
        </p>
      </div>

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
