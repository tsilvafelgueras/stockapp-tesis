'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RecoverPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/confirm?next=/auth/setup`

    const { error: rpError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo }
    )

    setLoading(false)

    if (rpError) {
      console.error(rpError)
    }
    setEnviado(true)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-action font-heading text-lg font-bold text-action-foreground">
              N
            </div>
            <p className="font-heading text-2xl font-bold">NUDO</p>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-normal">
              Recuperar contraseña
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Te mandamos un link para crear una nueva.
            </p>
          </div>
        </div>

        {enviado ? (
          <div className="space-y-2 rounded-md border border-success/30 bg-success/10 p-4 text-sm">
            <p className="font-medium text-success">Listo</p>
            <p className="text-foreground">
              Si <strong>{email.trim()}</strong> esta registrado, te llega un
              email con instrucciones en los proximos minutos.
            </p>
            <p className="text-xs text-muted-foreground">
              Revisa la carpeta de spam si no lo ves.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="usuario@mail.com"
                  className="w-full rounded-md border border-input bg-white py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-semibold text-action-foreground transition-colors hover:bg-action/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar link de recuperacion'}
            </button>
          </form>
        )}

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Volver al login
          </Link>
        </div>
      </div>
    </main>
  )
}
