'use client'

import { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
    <main className="flex min-h-screen items-start justify-center bg-white px-4 py-8 sm:px-6 sm:py-10">
      <section className="w-full max-w-[26rem] space-y-5">
        <div className="mx-auto h-14 w-52 overflow-hidden sm:h-16 sm:w-56">
          <Image
            src="/nudo-palabra.svg"
            alt="NUDO"
            width={224}
            height={64}
            priority
            className="h-full w-full object-cover object-center"
          />
        </div>

        <div className="w-full rounded-2xl border border-[#d9dee8] bg-white px-5 py-6 shadow-[0_8px_24px_rgba(26,43,74,0.07)] sm:px-7 sm:py-7">
          <div className="text-center">
            <h1
              className="text-2xl font-bold tracking-normal sm:text-[1.75rem]"
              style={{ color: BRAND_BLUE }}
            >
              Iniciar sesión
            </h1>
            <p className="mt-2 text-sm text-[#5c6980]">
              Ingresá tus datos para iniciar sesión
            </p>
          </div>

          {empresaPausada && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-semibold text-amber-700">Tu empresa está pausada</p>
              <p className="mt-1 text-[#5c6980]">
                Contacta al administrador de la plataforma para reactivarla.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                className="h-11 w-full rounded-xl border border-[#d9dee8] bg-white px-4 text-[15px] text-[#1a2b4a] outline-none transition placeholder:text-[#9ba2af] focus:border-[#1a2b4a] focus:ring-2 focus:ring-[#1a2b4a]/15"
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
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-[#d9dee8] bg-white px-4 text-[15px] text-[#1a2b4a] outline-none transition placeholder:text-[#9ba2af] focus:border-[#1a2b4a] focus:ring-2 focus:ring-[#1a2b4a]/15"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1a2b4a] px-4 text-sm font-semibold text-white transition hover:bg-[#24395d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Ingresando...' : 'Continuar'}
            </button>
          </form>

          <div className="pt-5 text-center">
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
