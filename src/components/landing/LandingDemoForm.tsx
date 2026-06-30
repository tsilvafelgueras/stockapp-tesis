'use client'

import { FormEvent, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

const FORMSPREE_URL = 'https://formspree.io/f/xnjypebw'

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export default function LandingDemoForm() {
  const [status, setStatus] = useState<SubmitState>('idle')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setStatus('submitting')

    try {
      const response = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      })

      if (!response.ok) {
        setStatus('error')
        return
      }

      form.reset()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <form
      action={FORMSPREE_URL}
      method="POST"
      onSubmit={handleSubmit}
      className="p-6 sm:p-8 lg:p-10"
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
        Formulario
      </p>
      <h3 className="mt-3 font-heading text-2xl font-bold text-slate-950">
        Contanos sobre tu fábrica
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Te escribimos por WhatsApp o email para agendar la demo.
      </p>

      <div className="mt-7 grid gap-5">
        <Field label="Nombre" htmlFor="demo-name">
          <input
            id="demo-name"
            name="Nombre"
            type="text"
            placeholder="Tu nombre"
            autoComplete="name"
            required
            className="w-full"
          />
        </Field>

        <Field label="Empresa" htmlFor="demo-company">
          <input
            id="demo-company"
            name="Empresa"
            type="text"
            placeholder="Tu empresa"
            autoComplete="organization"
            required
            className="w-full"
          />
        </Field>

        <Field label="Email" htmlFor="demo-email">
          <input
            id="demo-email"
            name="email"
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
            required
            className="w-full"
          />
        </Field>

        <Field label="Teléfono" optional htmlFor="demo-phone">
          <div className="flex overflow-hidden rounded-md border border-input bg-white focus-within:border-action focus-within:ring-2 focus-within:ring-action/35">
            <span className="inline-flex min-h-11 items-center border-r border-input bg-slate-50 px-3 text-sm font-semibold text-slate-500">
              +54
            </span>
            <input
              id="demo-phone"
              name="Teléfono"
              type="tel"
              placeholder="9 11 5555 5555"
              autoComplete="tel"
              className="min-h-11 flex-1 border-0 focus-visible:ring-0"
            />
          </div>
        </Field>

        <Field label="Mensaje" optional htmlFor="demo-message">
          <textarea
            id="demo-message"
            name="Mensaje"
            placeholder="Cuántos rollos manejás por mes, qué tintorerías, qué te traba hoy..."
            className="min-h-28 w-full resize-y"
          />
        </Field>
      </div>

      <p className="mt-5 text-xs leading-5 text-slate-500">
        Al enviar aceptás que te contactemos para coordinar la demo. No usamos
        tus datos para nada más.
      </p>

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-sky-500 px-6 text-sm font-bold text-white shadow-[0_8px_20px_-4px_rgba(14,165,233,0.45)] transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === 'submitting'
          ? 'Enviando...'
          : status === 'success'
            ? 'Recibido, te contactamos pronto'
            : 'Agendar demo'}
        {status !== 'submitting' && <ArrowRight className="size-4" />}
      </button>

      {status === 'error' && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No pudimos enviar el formulario. Escribinos a nudostock@gmail.com y
          lo resolvemos.
        </p>
      )}
    </form>
  )
}

function Field({
  label,
  optional = false,
  htmlFor,
  children,
}: {
  label: string
  optional?: boolean
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-semibold text-slate-800"
      >
        {label}
        {optional && (
          <span className="ml-1 font-normal text-slate-400">opcional</span>
        )}
      </label>
      {children}
    </div>
  )
}
