import { createClient } from '@/lib/supabase/server'
import BackButton from './BackButton'

/**
 * Botón "Volver al inicio" que decide el dashboard según el rol REAL del
 * usuario logueado, no según el path de la pantalla actual.
 *
 * Esto importa en las rutas neutras (`/ingresos`, `/picking`, `/pedidos`,
 * etc.) que tienen acceso compartido entre operario+admin o ventas+admin:
 * un admin viendo `/picking` debe volver a `/admin/dashboard`, no a
 * `/operario/dashboard`.
 */
export default async function DashboardBackButton({
  label = 'Volver al inicio',
}: {
  label?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let href = '/'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role as
      | 'operario'
      | 'ventas'
      | 'admin'
      | 'super'
      | undefined
    if (role === 'super') href = '/super'
    else if (role === 'operario') href = '/operario/dashboard'
    else if (role === 'ventas') href = '/ventas/dashboard'
    else if (role === 'admin') href = '/admin/dashboard'
  }

  return <BackButton href={href} label={label} />
}
