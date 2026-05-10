'use client'

import { useState } from 'react'
import Link from 'next/link'
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
      // No filtrar si el email existe o no, por seguridad. Mensaje genérico.
      console.error(rpError)
    }
    setEnviado(true)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm space-y-6 rounded-xl bg-white p-8 shadow-sm border">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Recuperar contraseña
          </h1>
          <p className="text-sm text-muted-foreground">
            Te mandamos un link a tu email para crear una nueva
          </p>
        </div>

        {enviado ? (
          <div className="rounded-md border border-success/30 bg-success/10 p-4 text-sm space-y-2">
            <p className="font-medium text-success">Listo</p>
            <p className="text-foreground">
              Si <strong>{email.trim()}</strong> está registrado, te llega un
              email con instrucciones en los próximos minutos.
            </p>
            <p className="text-muted-foreground text-xs">
              Revisá la carpeta de spam si no lo ves.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="usuario@mail.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Enviando…' : 'Enviar link de recuperación'}
            </button>
          </form>
        )}

        <div className="text-center">
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Volver al login
          </Link>
        </div>
      </div>
    </main>
  )
}
