import Link from 'next/link'
import {
  ArrowRight,
  Boxes,
  ScanLine,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Building2,
  ClipboardList,
  Upload,
  Truck,
  CheckCircle2,
} from 'lucide-react'

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0-2.16C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.88 5.88 0 0 0-2.13 1.38A5.88 5.88 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91a5.88 5.88 0 0 0 1.38 2.13c.66.66 1.32 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.88 5.88 0 0 0 2.13-1.38 5.88 5.88 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.88 5.88 0 0 0-1.38-2.13A5.88 5.88 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.84a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z" />
    </svg>
  )
}
import BrandMark from '@/components/BrandMark'

const DEMO_EMAIL = 'hola@nudo.com.ar'
const DEMO_MAILTO = `mailto:${DEMO_EMAIL}?subject=Quiero%20una%20demo%20de%20NUDO&body=Hola%2C%20me%20gustar%C3%ADa%20conocer%20NUDO%20para%20mi%20f%C3%A1brica%20textil.%0A%0AEmpresa%3A%0ANombre%3A%0ATel%C3%A9fono%3A%0ACantidad%20aproximada%20de%20rollos%20por%20mes%3A%0A`

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Privacy />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark className="size-9" />
          <span className="font-heading text-lg font-bold tracking-tight">
            NUDO
          </span>
        </Link>

        <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <a className="transition-colors hover:text-foreground" href="#features">
            Características
          </a>
          <a className="transition-colors hover:text-foreground" href="#como-funciona">
            Cómo funciona
          </a>
          <a className="transition-colors hover:text-foreground" href="#privacidad">
            Privacidad
          </a>
          <a className="transition-colors hover:text-foreground" href="#contacto">
            Contacto
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:px-4"
          >
            Ingresar
          </Link>
          <a
            href={DEMO_MAILTO}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-action px-3 text-sm font-semibold text-action-foreground shadow-sm transition-colors hover:bg-action/90 sm:px-4"
          >
            Pedir demo
            <ArrowRight className="size-4" />
          </a>
        </div>
      </nav>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(60rem 30rem at 80% -10%, rgba(42,143,232,0.18), transparent), radial-gradient(40rem 20rem at -10% 30%, rgba(26,47,84,0.12), transparent)',
        }}
      />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-8 lg:py-28">
        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-action/25 bg-action/10 px-3 py-1 text-xs font-medium text-foreground">
            <Sparkles className="size-3.5 text-action" />
            Diseñado para fábricas textiles argentinas
          </div>

          <h1 className="mt-5 font-heading text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            El stock de tu depósito,{' '}
            <span className="text-action">en orden y al toque.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            NUDO es el software de gestión de rollos para PyMEs textiles.
            Cargá planillas de tintorería con IA, confirmá cada rollo con
            scanner y armá pedidos sin equivocarte. Pensado para que lo use
            la persona del depósito desde el celular.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={DEMO_MAILTO}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-action px-6 text-sm font-semibold text-action-foreground shadow-sm transition-colors hover:bg-action/90"
            >
              Pedir una demo
              <ArrowRight className="size-4" />
            </a>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-input bg-white px-6 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Ya tengo cuenta
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <li className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              Multi-empresa con datos aislados
            </li>
            <li className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              Sin instalación, corre en el navegador
            </li>
            <li className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              Soporte en español, en Argentina
            </li>
          </ul>
        </div>

        <HeroMockup />
      </div>
    </section>
  )
}

function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="relative rounded-2xl border border-border bg-white p-4 shadow-[0_20px_60px_rgba(26,47,84,0.18)]">
        <div className="flex items-center gap-1.5 border-b border-border pb-3">
          <span className="size-2.5 rounded-full bg-destructive/70" />
          <span className="size-2.5 rounded-full bg-warning/80" />
          <span className="size-2.5 rounded-full bg-success/80" />
          <span className="ml-3 truncate text-xs text-muted-foreground">
            nudo.app/stock
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4">
          <MockStat label="Rollos en stock" value="1.248" tone="action" />
          <MockStat label="Pedidos activos" value="17" tone="warning" />
          <MockStat label="Kilos totales" value="38.420" tone="success" />
        </div>

        <div className="mt-4 rounded-lg border border-border">
          <div className="grid grid-cols-[1fr_70px_60px] gap-2 border-b border-border bg-secondary/60 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Rollo</span>
            <span className="text-right">Kg</span>
            <span className="text-right">Ubic.</span>
          </div>
          {[
            ['204023686', 'Lycra Negro', '21,75', 'A14'],
            ['204023687', 'Lycra Negro', '22,10', 'A14'],
            ['204023812', 'Microfibra Marino', '18,90', 'B07'],
            ['204023813', 'Microfibra Marino', '19,40', 'B07'],
            ['204024105', 'Algodón Blanco', '24,30', 'C22'],
          ].map(([n, art, kg, ub]) => (
            <div
              key={n}
              className="grid grid-cols-[1fr_70px_60px] items-center gap-2 border-b border-border/60 px-3 py-2 text-[13px] last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-foreground">{n}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {art}
                </p>
              </div>
              <span className="text-right tabular-nums">{kg}</span>
              <span className="text-right font-mono text-xs">{ub}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-6 -right-3 hidden w-[14rem] rotate-3 rounded-xl border border-border bg-white p-3 shadow-[0_14px_36px_rgba(26,47,84,0.22)] sm:block">
        <div className="flex items-center gap-2 text-[11px] font-medium text-success">
          <ScanLine className="size-3.5" />
          Rollo confirmado
        </div>
        <p className="mt-1 font-mono text-sm font-semibold text-foreground">
          204023686
        </p>
        <p className="text-[11px] text-muted-foreground">
          Ubicación A14 · 21,75 kg
        </p>
      </div>
    </div>
  )
}

function MockStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'action' | 'warning' | 'success'
}) {
  const toneClass =
    tone === 'action'
      ? 'text-action'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-success'
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 font-heading text-xl font-bold ${toneClass}`}>
        {value}
      </p>
    </div>
  )
}

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Planillas con IA',
    text: 'Subís la foto o PDF de la planilla de la tintorería y NUDO extrae los rollos automáticamente. Cada tintorería tiene su propia configuración.',
  },
  {
    icon: ScanLine,
    title: 'Scanner de rollos',
    text: 'Confirmación física con QR o código de barras desde el celular. Si el rollo no pertenece al ingreso, el sistema bloquea: nada se carga mal.',
  },
  {
    icon: ClipboardList,
    title: 'Pedidos y picking',
    text: 'Ventas elige los rollos puntuales para cada cliente. Operario hace el picking escaneando, sin chance de entregar la pieza equivocada.',
  },
  {
    icon: Smartphone,
    title: 'Mobile-first de verdad',
    text: 'Pensada para depósito: tipografía grande, botones generosos, todo a una mano. La gente del depósito la aprende en un día.',
  },
  {
    icon: ShieldCheck,
    title: 'Historial inborrable',
    text: 'Cada cambio queda registrado: quién, cuándo, qué movió. Cumple con auditoría sin que tengas que llevar un Excel paralelo.',
  },
  {
    icon: Building2,
    title: 'Multi-empresa con datos aislados',
    text: 'Cada empresa ve sólo sus datos. No mezclamos, no cruzamos, no usamos tu información para entrenar modelos ni para otros clientes. Tus rollos, pedidos y clientes son tuyos.',
  },
]

function Features() {
  return (
    <section
      id="features"
      className="border-t border-border bg-white py-20 sm:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-action">
            Por qué NUDO
          </p>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Todo lo que necesita una fábrica textil, sin lo que sobra.
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Construido a la medida del rubro: rollos, tintorerías, partidas y
            piezas. No es un ERP genérico forzado a entender tela.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-[0_12px_30px_rgba(26,47,84,0.08)]"
            >
              <div className="inline-flex size-11 items-center justify-center rounded-xl bg-action/10 text-action transition-colors group-hover:bg-action group-hover:text-action-foreground">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    icon: Upload,
    title: 'Cargás el ingreso',
    text: 'Sacás foto de la planilla de la tintorería o cargás los rollos a mano. La IA arma la tabla por vos en segundos.',
  },
  {
    icon: ScanLine,
    title: 'Confirmás en depósito',
    text: 'El operario escanea cada rollo con el celular. Si no coincide, NUDO bloquea. Cada rollo queda con su ubicación.',
  },
  {
    icon: Boxes,
    title: 'Armás pedidos',
    text: 'Ventas selecciona los rollos puntuales que cubren cada pedido. Sin doble carga en planillas paralelas.',
  },
  {
    icon: Truck,
    title: 'Entregás sin errores',
    text: 'Picking con scanner, confirmación de venta y despacho final. El stock real siempre coincide con el sistema.',
  },
]

function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="bg-sidebar py-20 text-sidebar-foreground sm:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-action">
            Cómo funciona
          </p>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            De la planilla en papel al stock en pantalla, en 4 pasos.
          </h2>
          <p className="mt-4 text-base text-white/70 sm:text-lg">
            El flujo completo: desde que llega la mercadería de la tintorería
            hasta que sale por la puerta del depósito.
          </p>
        </div>

        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li
              key={title}
              className="relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
            >
              <span className="absolute -top-3 left-6 inline-flex h-7 items-center justify-center rounded-full bg-action px-3 text-xs font-bold text-action-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="inline-flex size-11 items-center justify-center rounded-xl bg-white/10 text-white">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold text-white">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/70">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Privacy() {
  return (
    <section id="privacidad" className="border-t border-border bg-background py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-action/25 bg-action/10 px-3 py-1 text-xs font-medium text-foreground">
            <ShieldCheck className="size-3.5 text-action" />
            Privacidad y seguridad
          </div>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Tus datos son tuyos.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            En este rubro, la información de tu fábrica vale. Por eso lo
            tratamos como tal: cada empresa ve sólo sus propios datos, y nunca
            usamos información de un cliente para nadie más.
          </p>
        </div>

        <ul className="space-y-5 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          {[
            {
              title: 'Aislamiento total por empresa',
              text: 'Cada empresa tiene su propio espacio. Tus rollos, pedidos y clientes no se cruzan con los de otros usuarios ni se comparten entre fábricas.',
            },
            {
              title: 'No usamos tus datos para nada más',
              text: 'No entrenamos modelos con tu información, no la vendemos y no la compartimos con terceros. Punto.',
            },
            {
              title: 'Acceso controlado por rol',
              text: 'Vos definís quién ve qué. Operario, ventas y admin tienen permisos distintos, y cada cambio queda registrado con nombre y fecha.',
            },
            {
              title: 'Servidores en Argentina (São Paulo)',
              text: 'Infraestructura en la región, sin saltos innecesarios al exterior. Conexión cifrada de extremo a extremo.',
            },
          ].map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
              <div>
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {item.text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section id="contacto" className="bg-background py-20 sm:py-24">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-border bg-white px-6 py-12 shadow-[0_20px_60px_rgba(26,47,84,0.10)] sm:px-12 sm:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                Probá NUDO en tu fábrica.
              </h2>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                Te mostramos cómo se ve con datos reales de tu depósito.
                Onboarding guiado, sin compromiso, en 30 minutos.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href={DEMO_MAILTO}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-action px-6 text-sm font-semibold text-action-foreground shadow-sm transition-colors hover:bg-action/90"
                >
                  Pedir una demo
                  <ArrowRight className="size-4" />
                </a>
                <a
                  href={`mailto:${DEMO_EMAIL}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-input bg-white px-6 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  Contactanos
                </a>
              </div>
            </div>

            <ul className="space-y-4 rounded-2xl bg-secondary/50 p-6 text-sm">
              {[
                'Sin instalación: corre en cualquier navegador.',
                'Datos en servidores en Argentina (São Paulo).',
                'Soporte directo del equipo que desarrolla el producto.',
                'Pensado para empezar con una sola fábrica y crecer.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <BrandMark className="size-9" />
          <div>
            <p className="font-heading text-base font-bold leading-none">
              NUDO
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              WMS textil para PyMEs
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-6">
          <a className="hover:text-foreground" href="#features">
            Características
          </a>
          <a className="hover:text-foreground" href="#como-funciona">
            Cómo funciona
          </a>
          <a className="hover:text-foreground" href={`mailto:${DEMO_EMAIL}`}>
            {DEMO_EMAIL}
          </a>
          <Link className="hover:text-foreground" href="/login">
            Ingresar
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://www.linkedin.com/company/nudostock"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="NUDO en LinkedIn"
            className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-action hover:bg-action hover:text-action-foreground"
          >
            <LinkedinIcon className="size-4" />
          </a>
          <a
            href="https://www.instagram.com/nudo.stock"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="NUDO en Instagram"
            className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-action hover:bg-action hover:text-action-foreground"
          >
            <InstagramIcon className="size-4" />
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          Copyright © {new Date().getFullYear()} NUDO
        </p>
      </div>
    </footer>
  )
}
