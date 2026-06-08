'use client'

import { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
    <main className="flex min-h-screen items-start justify-center bg-white px-4 py-10 sm:px-6 sm:py-12">
      <section className="w-full max-w-[36.5rem] space-y-8">
        <div className="mx-auto h-20 w-64 overflow-hidden sm:w-72">
          <Image
            src="/nudo-palabra.svg"
            alt="NUDO"
            width={288}
            height={80}
            priority
            className="h-full w-full object-cover object-center"
          />
        </div>

        <div className="w-full rounded-[1.75rem] border border-zinc-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-normal text-zinc-950 sm:text-4xl">
              Iniciar sesión
            </h1>
            <p className="mt-3 text-base text-zinc-500 sm:text-lg">
              Ingresá tus datos para iniciar sesión
            </p>
          </div>

          {empresaPausada && (
            <div className="mt-7 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-zinc-700">
              <p className="font-semibold text-amber-700">Tu empresa está pausada</p>
              <p className="mt-1 text-zinc-600">
                Contacta al administrador de la plataforma para reactivarla.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-base font-semibold text-zinc-950">
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
                className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-base font-semibold text-zinc-950"
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
                className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-zinc-950 px-4 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Ingresando...' : 'Continuar'}
            </button>
          </form>

          <div className="pt-7 text-center">
            <Link
              href="/auth/recover"
              className="text-sm text-zinc-950 underline underline-offset-2 hover:text-zinc-700"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
