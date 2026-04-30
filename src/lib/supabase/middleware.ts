import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type Role = 'operario' | 'ventas' | 'admin'

function dashboardForRole(role: Role | null | undefined): string {
  if (role === 'operario') return '/operario/dashboard'
  if (role === 'ventas') return '/ventas/dashboard'
  return '/admin/dashboard'
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rutas públicas o de verificación de auth no requieren sesión
  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/auth/confirm') ||
    pathname === '/auth/recover'

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_super_admin')
      .eq('id', user.id)
      .single()

    const role = profile?.role as Role | undefined
    const isSuperAdmin = profile?.is_super_admin === true
    const dest = dashboardForRole(role)

    // /auth/setup requiere sesión pero no debe rebotar al dashboard
    if (pathname === '/auth/setup') {
      return supabaseResponse
    }

    // En login o raíz → al dashboard del rol (super-admin va a /super)
    if (pathname === '/' || pathname === '/login') {
      return NextResponse.redirect(
        new URL(isSuperAdmin ? '/super' : dest, request.url)
      )
    }

    // /super solo para super-admin
    if (pathname.startsWith('/super') && !isSuperAdmin) {
      return NextResponse.redirect(new URL(dest, request.url))
    }

    // Guards por sección de rol
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL(dest, request.url))
    }
    if (
      pathname.startsWith('/ventas') &&
      role !== 'ventas' &&
      role !== 'admin'
    ) {
      return NextResponse.redirect(new URL(dest, request.url))
    }
    if (
      pathname.startsWith('/operario') &&
      role !== 'operario' &&
      role !== 'admin'
    ) {
      return NextResponse.redirect(new URL(dest, request.url))
    }
  }

  return supabaseResponse
}
