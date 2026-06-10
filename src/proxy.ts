import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// El dominio viejo *.vercel.app lo flaggeó Google Safe Browsing (es un
// subdominio gratuito con login). Redirigimos todo el tráfico de ahí a
// nuestro dominio propio, preservando path + querystring. 308 = permanente.
// Si en el futuro cambiás el canónico a `nudostock.com` (sin www), ajustá
// CANONICAL_HOST.
const LEGACY_HOST = 'stockapp-tesis.vercel.app'
const CANONICAL_HOST = 'www.nudostock.com'

export async function proxy(request: NextRequest) {
  if (request.headers.get('host') === LEGACY_HOST) {
    const url = request.nextUrl.clone()
    url.protocol = 'https:'
    url.host = CANONICAL_HOST
    url.port = ''
    return NextResponse.redirect(url, 308)
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
