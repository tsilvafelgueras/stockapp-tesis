import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Route handler que verifica el token de invitación de Supabase Auth.
 *
 * Cuando un usuario es invitado por email, recibe un link tipo:
 *   <site>/auth/confirm?token_hash=xxx&type=invite&next=/auth/setup
 *
 * Este endpoint intercambia el token por una sesión de Supabase
 * y redirige al `next` (típicamente /auth/setup para que el usuario
 * defina su contraseña).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as
    | 'signup'
    | 'invite'
    | 'recovery'
    | 'email_change'
    | null
  // Solo aceptamos rutas internas en `next` (debe empezar con "/" seguido de
  // un caracter que no sea "/" ni "\"). Esto evita un open redirect del tipo
  // ?next=https://sitio-malo.com o ?next=//sitio-malo.com — que además de ser
  // un agujero de seguridad, es una señal típica de phishing para los scanners.
  const rawNext = url.searchParams.get('next') ?? '/auth/setup'
  const next = /^\/[^/\\]/.test(rawNext) ? rawNext : '/auth/setup'

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', request.url))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.verifyOtp({ type, token_hash })

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    )
  }

  return NextResponse.redirect(new URL(next, request.url))
}
