'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Wrapper requerido por Next 16: useSearchParams() en componentes client que
// se prerenderizan necesita estar dentro de un boundary de Suspense.
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
  const [empresaPausada, setEmpresaPausada] = useState(false)
  const router = useRouter()
  const sp = useSearchParams()

  // Si llegamos acá vía middleware con la empresa pausada, hacemos signOut
  // para limpiar la sesión: si no, el cookie autenticado sigue activo y el
  // middleware sigue rebotando al usuario.
  useEffect(() => {
    if (sp.get('empresa_pausada') === '1') {
      setEmpresaPausada(true)
      const supabase = createClient()
      supabase.auth.signOut()
    }
  }, [sp])

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
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm space-y-6 rounded-xl bg-white p-8 shadow-sm border">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">StockApp</h1>
          <p className="text-sm text-muted-foreground">Ingresá con tu cuenta</p>
        </div>

        {empresaPausada && (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
            <p className="font-medium text-warning">
              Tu empresa está pausada
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Contactá al administrador de la plataforma para reactivarla.
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
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="text-center pt-2">
          <Link
            href="/auth/recover"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
    </main>
  )
}
