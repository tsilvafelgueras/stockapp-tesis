import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type Role = 'operario' | 'ventas' | 'admin'

function dashboardForRole(role: Role | null | undefined): string {
  if (role === 'operario') return '/operario/dashboard'
  if (role === 'ventas') return '/ventas/dashboard'
  return '/admin/dashboard' // admin (dueño) y default
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

  // Sin sesión → al login (excepto si ya está en /login)
  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role as Role | undefined
    const dest = dashboardForRole(role)

    // En login o raíz → al dashboard del rol
    if (pathname === '/' || pathname === '/login') {
      return NextResponse.redirect(new URL(dest, request.url))
    }

    // Guards por sección
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
