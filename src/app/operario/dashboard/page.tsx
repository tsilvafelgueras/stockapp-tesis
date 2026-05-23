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

type ActionTone = 'accent2' | 'action' | 'success' | 'plum' | 'teal' | 'warning'

const actions: {
  href: string
  title: string
  description: string
  icon: LucideIcon
  tone: ActionTone
}[] = [
  {
    href: '/ingresos/nuevo',
    title: 'Cargar ingreso',
    description: 'Subí la planilla o cargá los rollos a mano cuando llega mercadería.',
    icon: PackagePlus,
    tone: 'accent2',
  },
  {
    href: '/confirmar',
    title: 'Escanear llegadas',
    description: 'Confirmar rollos pendientes y asignarles ubicación.',
    icon: ScanLine,
    tone: 'action',
  },
  {
    href: '/stock',
    title: 'Buscar stock',
    description: 'Encontrar rollos disponibles y mover ubicaciones.',
    icon: Search,
    tone: 'teal',
  },
  {
    href: '/picking',
    title: 'Picking',
    description: 'Preparar pedidos escaneando los rollos del depósito.',
    icon: ClipboardCheck,
    tone: 'success',
  },
  {
    href: '/ingresos',
    title: 'Ver ingresos',
    description: 'Listado de llegadas cargadas, auditadas y pendientes.',
    icon: Truck,
    tone: 'plum',
  },
  {
    href: '/muestras',
    title: 'Muestras',
    description: 'Registrar entregas chicas que descuentan kilos del rollo.',
    icon: Scissors,
    tone: 'warning',
  },
]

const TONE_STYLES: Record<
  ActionTone,
  { bg: string; hoverBorder: string; focusBorder: string; ring: string }
> = {
  accent2: {
    bg: 'bg-accent2-soft text-accent2',
    hoverBorder: 'hover:border-accent2/40',
    focusBorder: 'focus-visible:border-accent2',
    ring: 'focus-visible:ring-accent2/30',
  },
  action: {
    bg: 'bg-action/10 text-action',
    hoverBorder: 'hover:border-action/40',
    focusBorder: 'focus-visible:border-action',
    ring: 'focus-visible:ring-action/30',
  },
  success: {
    bg: 'bg-success/15 text-success',
    hoverBorder: 'hover:border-success/40',
    focusBorder: 'focus-visible:border-success',
    ring: 'focus-visible:ring-success/30',
  },
  plum: {
    bg: 'bg-brand-plum/10 text-brand-plum',
    hoverBorder: 'hover:border-brand-plum/40',
    focusBorder: 'focus-visible:border-brand-plum',
    ring: 'focus-visible:ring-brand-plum/30',
  },
  teal: {
    bg: 'bg-brand-teal/12 text-brand-teal',
    hoverBorder: 'hover:border-brand-teal/40',
    focusBorder: 'focus-visible:border-brand-teal',
    ring: 'focus-visible:ring-brand-teal/30',
  },
  warning: {
    bg: 'bg-warning/15 text-warning',
    hoverBorder: 'hover:border-warning/40',
    focusBorder: 'focus-visible:border-warning',
    ring: 'focus-visible:ring-warning/30',
  },
}

export default function OperarioDashboard() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-4 py-5 sm:px-6 md:min-h-dvh md:py-8">
      <div className="relative mb-5 overflow-hidden rounded-xl bg-sidebar p-5 text-white shadow-sm sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(20rem 12rem at 110% -10%, rgba(232,145,58,0.24), transparent), radial-gradient(18rem 12rem at -10% 120%, rgba(42,143,232,0.18), transparent)',
          }}
        />
        <p className="relative text-xs font-semibold uppercase tracking-[0.08em] text-accent2">
          Deposito
        </p>
        <h1 className="relative mt-2 text-2xl font-bold">¿Qué vas a mover hoy?</h1>
      </div>

      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {actions.map((item) => {
          const Icon = item.icon
          const s = TONE_STYLES[item.tone]
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex min-h-28 items-start gap-4 rounded-lg border bg-white p-4 text-foreground shadow-sm outline-none transition-all ${s.hoverBorder} hover:shadow-md ${s.focusBorder} focus-visible:ring-2 ${s.ring} active:scale-[0.99]`}
            >
              <span className={`flex size-12 shrink-0 items-center justify-center rounded-md ${s.bg}`}>
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
