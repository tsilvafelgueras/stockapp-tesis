'use client'

import { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BRAND_BLUE = '#1a2b4a'

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
  const [showPassword, setShowPassword] = useState(false)
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

    if (profile?.role === 'super') {
      router.push('/super')
    } else if (profile?.role === 'operario') {
      router.push('/operario/dashboard')
    } else if (profile?.role === 'ventas') {
      router.push('/ventas/dashboard')
    } else {
      router.push('/admin/dashboard')
    }
    router.refresh()
  }

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-white px-4 py-4 sm:px-6">
      <section className="w-full max-w-[23.5rem] space-y-3">
        <div className="mx-auto h-10 w-44 overflow-hidden sm:h-12 sm:w-48">
          <a href = "https://www.nudostock.com/"><Image
            src="/nudo-palabra.svg"
            alt="NUDO"
            width={192}
            height={48}
            priority
            className="h-full w-full object-cover object-center"
          />
          </a>
        </div>

        <div className="w-full rounded-xl border border-[#d9dee8] bg-white px-4 py-5 shadow-[0_8px_24px_rgba(26,43,74,0.07)] sm:px-6">
          <div className="text-center">
            <h1
              className="text-xl font-bold tracking-normal sm:text-2xl"
              style={{ color: BRAND_BLUE }}
            >
              Iniciar sesión
            </h1>
            <p className="mt-1 text-sm text-[#5c6980]">
              Ingresá tus datos para iniciar sesión
            </p>
          </div>

          {empresaPausada && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-semibold text-amber-700">Tu empresa está pausada</p>
              <p className="mt-1 text-[#5c6980]">
                Contacta al administrador de la plataforma para reactivarla.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-semibold"
                style={{ color: BRAND_BLUE }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="ejemplo@gmail.com"
                className="h-10 w-full rounded-lg border border-[#d9dee8] bg-white px-3 text-sm text-[#1a2b4a] outline-none transition placeholder:text-[#9ba2af] focus:border-[#1a2b4a] focus:ring-2 focus:ring-[#1a2b4a]/15"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-semibold"
                style={{ color: BRAND_BLUE }}
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-10 w-full rounded-lg border border-[#d9dee8] bg-white pl-3 pr-10 text-sm text-[#1a2b4a] outline-none transition placeholder:text-[#9ba2af] focus:border-[#1a2b4a] focus:ring-2 focus:ring-[#1a2b4a]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[#5c6980] transition hover:bg-[#f0f2f6] hover:text-[#1a2b4a]"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-[#1a2b4a] px-4 text-sm font-semibold text-white transition hover:bg-[#24395d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Ingresando...' : 'Continuar'}
            </button>
          </form>

          <div className="pt-4 text-center">
            <Link
              href="/auth/recover"
              className="text-sm text-[#1a2b4a] underline underline-offset-2 hover:text-[#24395d]"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
