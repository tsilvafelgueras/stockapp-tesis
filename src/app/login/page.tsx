'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Boxes } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const sp = useSearchParams()
  const empresaPausada = sp.get('empresa_pausada') === '1'

  useEffect(() => {
    if (empresaPausada) {
      const supabase = createClient()
      supabase.auth.signOut()
    }
  }, [empresaPausada])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'operario') {
      router.push('/operario/dashboard')
    } else if (profile?.role === 'ventas') {
      router.push('/ventas/dashboard')
    } else {
      router.push('/admin/dashboard')
    }
    router.refresh()
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1fr)]">
      <section className="hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-action font-heading text-xl font-bold text-action-foreground">
            N
          </div>
          <div>
            <p className="font-heading text-2xl font-bold leading-none">NUDO</p>
            <p className="mt-1 text-xs text-white/60">WMS textil</p>
          </div>
        </div>

        <div className="max-w-md space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/72">
            <Boxes className="size-3.5" />
            Stock real, sin vueltas
          </div>
          <h1 className="text-4xl font-bold leading-tight text-white">
            Rollos, pedidos y tintorerias en un solo lugar.
          </h1>
          <p className="text-base leading-7 text-white/68">
            Diseñado para deposito y ventas: rapido en celular, claro en
            escritorio y preparado para el ritmo de una PyME textil argentina.
          </p>
        </div>

        <p className="text-xs text-white/45">NUDO para equipos textiles</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md space-y-6 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-lg bg-action font-heading text-lg font-bold text-action-foreground">
                N
              </div>
              <p className="font-heading text-2xl font-bold">NUDO</p>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-normal">
                Entrar a la plataforma
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ingresa con tu cuenta de trabajo.
              </p>
            </div>
          </div>

          {empresaPausada && (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
              <p className="font-medium text-warning">Tu empresa esta pausada</p>
              <p className="mt-0.5 text-muted-foreground">
                Contacta al administrador de la plataforma para reactivarla.
              </p>
            </div>
          )}

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
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm placeholder:text-muted-foreground"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground transition-colors hover:bg-action/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
              {!loading && <ArrowRight className="size-4" />}
            </button>
          </form>

          <div className="text-center pt-1">
            <Link
              href="/auth/recover"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
