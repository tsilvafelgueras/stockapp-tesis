import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type Role = 'operario' | 'ventas' | 'admin' | 'super'

// Para super-admin con empresa_id_actuando seteada, el "home" es
// el dashboard de admin de esa empresa (está operando como admin
// de la cliente). Para super-admin sin impersonación, /super.
function dashboardForRole(
  role: Role | null | undefined,
  empresaActuando: string | null | undefined
): string {
  if (role === 'super') return empresaActuando ? '/admin/dashboard' : '/super'
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

  // Backward-compat: rutas que se renombraron al sacarles el prefijo de rol.
  // Mantiene viejos bookmarks y links externos funcionando con un redirect 308.
  const LEGACY_PATH_PREFIXES: Array<[string, string]> = [
    ['/operario/ingresos', '/ingresos'],
    ['/operario/confirmar', '/confirmar'],
    ['/operario/picking', '/picking'],
    ['/operario/muestras', '/muestras'],
    ['/ventas/pedidos-pendientes', '/pedidos-pendientes'],
    ['/ventas/pedidos', '/pedidos'],
    ['/ventas/clientes', '/clientes'],
  ]
  for (const [oldPrefix, newPrefix] of LEGACY_PATH_PREFIXES) {
    if (pathname === oldPrefix || pathname.startsWith(oldPrefix + '/')) {
      const target = new URL(
        newPrefix + pathname.slice(oldPrefix.length) + request.nextUrl.search,
        request.url
      )
      return NextResponse.redirect(target, 308)
    }
  }

  // Rutas públicas o de verificación de auth no requieren sesión
  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/auth/confirm') ||
    pathname === '/auth/recover'

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, empresa_id_actuando, empresas(activo)')
      .eq('id', user.id)
      .single()

    const role = profile?.role as Role | undefined
    const empresaActuando = (profile?.empresa_id_actuando as string | null) ?? null
    // Super-admin con empresa_id_actuando seteada: opera como admin
    // de esa empresa. El rol REAL sigue siendo 'super' (nunca cambia
    // en profiles.role) — esto es solo un flag de contexto para el
    // middleware y los layouts.
    const superActuando = role === 'super' && !!empresaActuando
    const dest = dashboardForRole(role, empresaActuando)

    // Bloqueo por empresa pausada (excepto super, que no tiene empresa)
    const empresaActiva =
      role === 'super' ||
      (
        profile?.empresas as unknown as { activo: boolean } | null
      )?.activo !== false

    if (!empresaActiva) {
      // Permitir solo /login (con flag) para que el cliente haga signOut.
      if (pathname !== '/login') {
        return NextResponse.redirect(
          new URL('/login?empresa_pausada=1', request.url)
        )
      }
      return supabaseResponse
    }

    // /auth/setup requiere sesión pero no debe rebotar al dashboard
    if (pathname === '/auth/setup') {
      return supabaseResponse
    }

    // En login o raíz → al dashboard del rol
    if (pathname === '/' || pathname === '/login') {
      return NextResponse.redirect(new URL(dest, request.url))
    }

    // /super solo para role='super' (con o sin impersonación —
    // el super puede volver al panel global en cualquier momento)
    if (pathname.startsWith('/super') && role !== 'super') {
      return NextResponse.redirect(new URL(dest, request.url))
    }

    // Rutas neutras (sin prefijo de rol) que pueden tocar varios roles.
    // Operación: operario+admin. Comercial: ventas+admin. Stock: todos los tenant.
    const isOperacion =
      pathname.startsWith('/ingresos') ||
      pathname.startsWith('/confirmar') ||
      pathname.startsWith('/picking') ||
      pathname.startsWith('/muestras')
    const isComercial =
      pathname.startsWith('/pedidos') ||
      pathname.startsWith('/pedidos-pendientes') ||
      pathname.startsWith('/clientes')
    const isStock = pathname.startsWith('/stock')
    const isNotificaciones = pathname.startsWith('/notificaciones')
    const isTenantArea =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/ventas') ||
      pathname.startsWith('/operario') ||
      isOperacion ||
      isComercial ||
      isStock ||
      isNotificaciones

    // Super-admin sin impersonación no puede entrar a rutas
    // de empresa-cliente (no tiene empresa_id, vería datos cruzados).
    // Si tiene empresa_id_actuando seteada, opera como admin de esa
    // empresa y los guards lo dejan pasar.
    if (role === 'super' && !superActuando && isTenantArea) {
      return NextResponse.redirect(new URL('/super', request.url))
    }

    // Guards por sección de rol. El super actuando se trata como
    // admin (admin es superset de operario+ventas, así que pasa
    // todos los guards). El rol REAL del usuario sigue siendo
    // 'super' en la DB — esto solo afecta el routing.
    const effectiveRole: Role | undefined = superActuando ? 'admin' : role
    if (pathname.startsWith('/admin') && effectiveRole !== 'admin') {
      return NextResponse.redirect(new URL(dest, request.url))
    }
    if (
      pathname.startsWith('/ventas') &&
      effectiveRole !== 'ventas' &&
      effectiveRole !== 'admin'
    ) {
      return NextResponse.redirect(new URL(dest, request.url))
    }
    if (
      pathname.startsWith('/operario') &&
      effectiveRole !== 'operario' &&
      effectiveRole !== 'admin'
    ) {
      return NextResponse.redirect(new URL(dest, request.url))
    }
    if (isOperacion && effectiveRole !== 'operario' && effectiveRole !== 'admin') {
      return NextResponse.redirect(new URL(dest, request.url))
    }
    if (isComercial && effectiveRole !== 'ventas' && effectiveRole !== 'admin') {
      return NextResponse.redirect(new URL(dest, request.url))
    }
    if (isNotificaciones && effectiveRole !== 'ventas' && effectiveRole !== 'admin') {
      return NextResponse.redirect(new URL(dest, request.url))
    }
  }

  return supabaseResponse
}
