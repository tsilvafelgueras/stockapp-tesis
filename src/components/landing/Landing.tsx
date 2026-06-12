import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  Factory,
  Mail,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Truck,
  Upload,
} from 'lucide-react'

import LandingDemoForm from './LandingDemoForm'

const DEMO_EMAIL = 'nudostock@gmail.com'

const VIDEO_SOURCES = {
  cargaIa:
    'https://www.dropbox.com/scl/fi/veubzxly6lbi2iglidzwy/carga-con-ia.mp4?rlkey=smejvvv9lbneym4k5lcfwuguo&st=dsx29epj&raw=1',
  racks:
    'https://www.dropbox.com/scl/fi/kup50sdp4d3crnnsmzj7j/WhatsApp-Video-2026-06-03-at-18.21.59.mp4?rlkey=o9kc8a89eg8v1mamu8nj09a3a&st=ynhcb03w&raw=1',
  capacitacion:
    'https://www.dropbox.com/scl/fi/std2cg47n61r0im7nyyr1/WhatsApp-Video-2026-06-03-at-18.21.48.mp4?rlkey=l65ggkuxewtwj70if6851u0rs&st=uth0roce&raw=1',
} as const

const PROBLEM_CARDS = [
  {
    icon: AlertTriangle,
    title: 'Rollos que se pierden',
    text: 'Entran al depósito, se ubican en algún rack y nadie los carga. Plata parada en piezas que el sistema dice que no existen.',
  },
  {
    icon: ClipboardList,
    title: 'Planillas que no coinciden',
    text: 'Remitos por foto o WhatsApp, kilos copiados a mano y datos que llegan tarde. Cada transcripción abre la puerta al error.',
  },
  {
    icon: Search,
    title: 'Ventas sin stock real',
    text: 'Se prometen piezas que ya salieron. El faltante aparece cuando el operario va a buscar el rollo, no cuando se vende.',
  },
]

const SOLUTION_CARDS = [
  {
    icon: ShieldCheck,
    title: 'Accesos por rol',
    text: 'Administración, ventas y depósito ven solo lo que necesitan para operar rápido y sin mezclar permisos.',
  },
  {
    icon: RefreshCw,
    title: 'Stock sincronizado',
    text: 'Cuando un rollo se confirma en planta, ventas lo ve disponible al instante. Sin doble carga ni planillas paralelas.',
  },
  {
    icon: BarChart3,
    title: 'Reportes accionables',
    text: 'Kilos por estado, rotación, tintorerías y tendencias. Métricas reales para decidir con el depósito al día.',
  },
]

const STEPS = [
  {
    icon: Upload,
    title: 'Sacás foto de la planilla',
    text: 'La IA detecta rollos, kilos y partida. Vos revisás y confirmás antes de impactar el ingreso.',
  },
  {
    icon: Boxes,
    title: 'Confirmás lo que llegó',
    text: 'El equipo de depósito controla el conteo, ubica cada pieza y deja el stock listo para vender.',
  },
  {
    icon: Building2,
    title: 'Ventas reserva rollos puntuales',
    text: 'Filtrás por artículo, kilos y ubicación. El pedido se arma con piezas exactas, sin prometer de más.',
  },
  {
    icon: Truck,
    title: 'Entregás sin errores',
    text: 'Picking guiado, escaneo de egreso y descuento en tiempo real. Sin sobra, sin faltante.',
  },
]

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

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <ProofStrip />
        <Problem />
        <Solution />
        <Implementation />
        <HowItWorks />
        <LeadSection />
      </main>
      <LandingFooter />
    </div>
  )
}

function MarketingBrandMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sky-400/60 bg-slate-900 shadow-[0_8px_22px_rgba(15,23,42,0.24)] ${className}`}
    >
      <Image
        src="/landing/nudo-logo.svg"
        alt="NUDO"
        width={916}
        height={1145}
        className="h-full w-full scale-[1.04] object-cover"
        priority
      />
    </span>
  )
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <MarketingBrandMark className="size-10" />
          <span className="font-heading text-lg font-extrabold tracking-tight text-slate-950">
            NUDO
          </span>
        </Link>

        <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <a className="transition-colors hover:text-slate-950" href="#solucion">
            Producto
          </a>
          <a className="transition-colors hover:text-slate-950" href="#problema">
            Beneficios
          </a>
          <a
            className="transition-colors hover:text-slate-950"
            href="#como-funciona"
          >
            Cómo funciona
          </a>
          <a className="transition-colors hover:text-slate-950" href="#contacto">
            Contacto
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 sm:border-0 sm:px-4"
          >
            <span className="hidden sm:inline">¿Ya sos usuario?</span>
            <span className="text-sky-600 sm:ml-1">Iniciá sesión</span>
          </Link>
          <a
            href="#contacto"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-sky-500 px-3 text-sm font-semibold text-white shadow-[0_8px_20px_-4px_rgba(14,165,233,0.45)] transition-colors hover:bg-sky-600 sm:px-4"
          >
            <span className="sm:hidden">Demo</span>
            <span className="hidden sm:inline">Pedí una demo</span>
            <ArrowRight className="size-4" />
          </a>
        </div>
      </nav>
    </header>
  )
}

function Hero() {
  return (
    <section id="hero" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(54rem 28rem at 78% 0%, rgba(14,165,233,0.16), transparent), radial-gradient(38rem 22rem at -12% 28%, rgba(15,23,42,0.08), transparent)',
        }}
      />

      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.12fr_1fr] lg:gap-20 lg:px-8 lg:py-28">
        <div className="flex flex-col justify-center">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
            Stock textil · gestión inteligente
          </span>

          <h1 className="mt-6 max-w-3xl font-heading text-5xl font-extrabold leading-[1.02] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
            Tu <span className="text-sky-500">depósito</span>
            <br />
            bajo control total.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            NUDO es el software de gestión de rollos para PyMEs textiles.
            Trazá cada pieza desde la tintorería hasta el despacho, con escaneo
            en mano y reportes en tiempo real.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#contacto"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-sky-500 px-6 text-sm font-bold text-white shadow-[0_8px_20px_-4px_rgba(14,165,233,0.45)] transition-colors hover:bg-sky-600"
            >
              Pedí una demo
              <ArrowRight className="size-4" />
            </a>
            <a
              href="#como-funciona"
              className="inline-flex h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
            >
              Cómo funciona
            </a>
          </div>
        </div>

        <HeroMockup />
      </div>
    </section>
  )
}

function HeroMockup() {
  const bars = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="relative mx-auto flex w-full max-w-md items-center justify-center lg:max-w-none">
      <div className="relative w-full max-w-[22rem] rounded-[2rem] border border-slate-800 bg-slate-950 p-3 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="rounded-[1.55rem] bg-slate-900 p-4 text-white">
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>9:41</span>
            <span>● ● ●</span>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <MarketingBrandMark className="size-9 rounded-lg" />
            <div>
              <p className="text-sm font-semibold text-white">
                Picking · Pedido #1248
              </p>
              <p className="text-xs text-white/55">Egreso · Lycra Negro</p>
            </div>
          </div>

          <div className="relative mt-5 aspect-square overflow-hidden rounded-2xl border border-sky-400/40 bg-slate-950 p-5">
            <span className="absolute left-4 top-4 size-8 border-l-2 border-t-2 border-sky-400" />
            <span className="absolute right-4 top-4 size-8 border-r-2 border-t-2 border-sky-400" />
            <span className="absolute bottom-4 left-4 size-8 border-b-2 border-l-2 border-sky-400" />
            <span className="absolute bottom-4 right-4 size-8 border-b-2 border-r-2 border-sky-400" />
            <div className="grid h-full grid-cols-8 items-center gap-1.5 opacity-70">
              {bars.map((bar) => (
                <span
                  key={bar}
                  className="mx-auto block w-full rounded-full bg-white"
                  style={{
                    height: `${34 + ((bar * 19) % 56)}%`,
                    opacity: 0.24 + ((bar % 5) * 0.1),
                  }}
                />
              ))}
            </div>
            <div className="absolute left-5 right-5 top-1/2 h-0.5 animate-pulse bg-sky-400 shadow-[0_0_22px_rgba(14,165,233,0.9)]" />
          </div>

          <div className="mt-5 rounded-2xl bg-white p-4 text-slate-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rollo a retirar
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="font-mono text-xl font-bold">204023688</p>
                <p className="text-sm text-slate-500">
                  Lycra Negro · 21,40 kg
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                OK
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -left-1 top-10 hidden w-48 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.14)] sm:block">
        <p className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600">
          <CheckCircle2 className="size-4" />
          Rollo retirado
        </p>
        <p className="mt-2 font-mono text-base font-bold text-slate-950">
          204023687
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Egreso confirmado · Pedido #1248
        </p>
      </div>

      <div className="absolute -bottom-4 -right-1 hidden w-52 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.14)] sm:block">
        <p className="inline-flex items-center gap-2 text-xs font-bold text-sky-600">
          <ScanLine className="size-4" />
          Picking · Pedido #1248
        </p>
        <p className="mt-2 text-sm font-bold text-slate-950">
          3 de 4 rollos
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full w-3/4 rounded-full bg-sky-500" />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Lycra Negro · listo para despacho
        </p>
      </div>
    </div>
  )
}

function ProofStrip() {
  return (
    <section aria-label="Prueba de NUDO" className="bg-slate-50 py-5">
      <div className="mx-auto grid w-full max-w-7xl gap-3 px-4 text-sm text-slate-600 sm:grid-cols-3 sm:px-6 lg:px-8">
        <ProofItem label="Validado con" value="Muter Textil" />
        <ProofItem label="Trazabilidad para" value="+12.000 rollos" />
        <ProofItem label="Proyecto" value="ITBA · industria textil" />
      </div>
    </section>
  )
}

function ProofItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span>{label}</span>
      <strong className="text-slate-950">{value}</strong>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  text,
  dark = false,
}: {
  eyebrow: string
  title: string
  text: string
  dark?: boolean
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p
        className={`text-xs font-bold uppercase tracking-[0.18em] ${
          dark ? 'text-sky-300' : 'text-sky-600'
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl ${
          dark ? 'text-white' : 'text-slate-950'
        }`}
      >
        {title}
      </h2>
      <p
        className={`mt-4 text-base leading-7 sm:text-lg ${
          dark ? 'text-white/70' : 'text-slate-600'
        }`}
      >
        {text}
      </p>
    </div>
  )
}

function Problem() {
  return (
    <section id="problema" className="bg-white py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="El problema"
          title="No sabés cuánto tenés, ni dónde está."
          text="Tu depósito mueve cientos de rollos por mes. Si esa operación vive en papel, WhatsApp y memoria, estás operando a ciegas."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {PROBLEM_CARDS.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition hover:border-red-200 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
            >
              <div className="inline-flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-bold text-slate-950">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Solution() {
  return (
    <section id="solucion" className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="La solución"
          title="Simplificá tu operación y ahorrá tiempo en el depósito."
          text="NUDO conecta ingreso, stock, ventas y picking en un flujo único pensado para el rubro textil."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:col-span-2">
            <div className="grid gap-6 p-6 md:grid-cols-[1fr_18rem] md:p-8">
              <div className="flex flex-col justify-center">
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                  <ScanLine className="size-5" />
                </div>
                <h3 className="mt-5 font-heading text-2xl font-bold text-slate-950">
                  Carga inteligente
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                  Subí la foto del remito y la IA carga los rollos al stock en
                  tiempo real. En la salida, escaneás cada rollo para
                  descontarlo, sin planillas ni errores.
                </p>
              </div>

              <div className="mx-auto w-full max-w-[18rem]">
                <VideoPhone
                  src={VIDEO_SOURCES.cargaIa}
                  title="Escaneo de rollos con IA"
                  label="escaneo de rollos · IA"
                />
              </div>
            </div>
          </article>

          {SOLUTION_CARDS.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition hover:border-sky-200 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
            >
              <div className="inline-flex size-11 items-center justify-center rounded-xl bg-sky-100 text-sky-600 transition group-hover:bg-sky-500 group-hover:text-white">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-bold text-slate-950">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function VideoPhone({
  src,
  title,
  label,
}: {
  src: string
  title: string
  label: string
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[1.55rem] bg-slate-900">
        <span className="absolute left-1/2 top-3 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/20" />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-wide text-white/45">
          {label}
        </div>
        <video
          className="relative z-[1] h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          title={title}
        >
          <source src={src} type="video/mp4" />
          <track
            src="/landing/empty-captions.vtt"
            kind="captions"
            srcLang="es"
            label="Sin audio"
          />
          Tu navegador no soporta video HTML5.
        </video>
      </div>
    </div>
  )
}

function Implementation() {
  return (
    <section id="implementacion" className="bg-white py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Implementación"
          title="Te acompañamos en el depósito desde el primer día."
          text="Vamos a tu fábrica para ayudarte con la puesta en marcha, el etiquetado de rollos viejos y el entrenamiento del equipo."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <ImplementationCard
            src={VIDEO_SOURCES.racks}
            title="Ordenamos el depósito físico"
            text="Etiquetamos y ubicamos cada rollo en su rack. Tu depósito queda listo y cargado en el sistema desde el día uno."
          />
          <ImplementationCard
            src={VIDEO_SOURCES.capacitacion}
            title="Capacitamos a tu gente"
            text="Entrenamos al equipo de depósito, administración y ventas hasta que todos operan con confianza, sin trabarse."
          />
        </div>
      </div>
    </section>
  )
}

function ImplementationCard({
  src,
  title,
  text,
}: {
  src: string
  title: string
  text: string
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
      <div className="relative aspect-video bg-slate-950">
        <video
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          title={title}
        >
          <source src={src} type="video/mp4" />
          <track
            src="/landing/empty-captions.vtt"
            kind="captions"
            srcLang="es"
            label="Sin audio"
          />
          Tu navegador no soporta video HTML5.
        </video>
        <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-sm">
          <Factory className="size-4 text-sky-600" />
          Depósito textil
        </span>
      </div>
      <div className="p-6">
        <h3 className="font-heading text-xl font-bold text-slate-950">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </article>
  )
}

function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="bg-slate-900 py-20 text-white sm:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Cómo funciona"
          title="De la planilla en papel al stock en pantalla, en cuatro pasos."
          text="El flujo completo: desde que la mercadería llega de la tintorería hasta que sale por la puerta del depósito. Sin vueltas, sin doble carga."
          dark
        />

        <ol className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              className="relative rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-sm"
            >
              <span className="absolute -top-3 left-6 inline-flex h-7 items-center justify-center rounded-full bg-sky-500 px-3 text-xs font-bold text-white">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="inline-flex size-11 items-center justify-center rounded-xl bg-white/10 text-white">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-bold text-white">
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

function LeadSection() {
  return (
    <section id="contacto" className="bg-white py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-slate-900 p-6 text-white sm:p-8 lg:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
              Pedí una demo
            </p>
            <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Probá NUDO en tu fábrica.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/70">
              Te mostramos cómo se ve con datos reales de tu depósito.
              Onboarding guiado, sin compromiso, en 30 minutos.
            </p>

            <ul className="mt-8 space-y-5">
              {[
                [
                  'Respuesta en 24 hs hábiles',
                  'Coordinamos la demo en el horario que te quede cómodo.',
                ],
                [
                  'Demo con tus datos',
                  'Mandanos una planilla de muestra y la probamos en vivo.',
                ],
                [
                  'Sin compromiso',
                  'Cotización y plan de implementación por escrito antes de avanzar.',
                ],
              ].map(([title, text]) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-sky-500 text-white">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/65">
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <LandingDemoForm />
        </div>
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr_0.7fr]">
          <div>
            <Link href="#hero" className="flex items-center gap-3">
              <MarketingBrandMark className="size-10" />
              <span className="font-heading text-lg font-extrabold">
                NUDO
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/65">
              La plataforma inteligente de gestión de stock para la industria
              textil. Diseñada para PyMEs argentinas.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <FooterSocial
                href="https://www.instagram.com/nudo.stock"
                label="NUDO en Instagram"
                icon={<InstagramIcon className="size-4" />}
              />
              <FooterSocial
                href="https://www.linkedin.com/company/nudostock"
                label="NUDO en LinkedIn"
                icon={<LinkedinIcon className="size-4" />}
              />
              <FooterSocial
                href={`mailto:${DEMO_EMAIL}`}
                label="Email de NUDO"
                icon={<Mail className="size-4" />}
              />
            </div>
          </div>

          <FooterLinks
            title="Producto"
            links={[
              ['El problema', '#problema'],
              ['La solución', '#solucion'],
              ['Cómo funciona', '#como-funciona'],
              ['Iniciar sesión', '/login'],
            ]}
          />
          <FooterLinks
            title="Empresa"
            links={[
              ['Pedir demo', '#contacto'],
              [DEMO_EMAIL, `mailto:${DEMO_EMAIL}`],
              ['Instagram', 'https://www.instagram.com/nudo.stock'],
              ['LinkedIn', 'https://www.linkedin.com/company/nudostock'],
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>Copyright © {new Date().getFullYear()} NUDO</span>
          <span>Buenos Aires, Argentina</span>
        </div>
      </div>
    </footer>
  )
}

function FooterSocial({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: ReactNode
}) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-sky-400 hover:bg-sky-500 hover:text-white"
    >
      {icon}
    </a>
  )
}

function FooterLinks({
  title,
  links,
}: {
  title: string
  links: [string, string][]
}) {
  return (
    <div>
      <h4 className="font-heading text-sm font-bold text-white">{title}</h4>
      <ul className="mt-4 space-y-3 text-sm text-white/60">
        {links.map(([label, href]) => (
          <li key={`${title}-${label}`}>
            <a
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="transition-colors hover:text-white"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
