import AppShellClient from './AppShellClient'
import { getNotificacionesNoLeidas } from '@/lib/notificaciones'

type Role = 'operario' | 'ventas' | 'admin' | 'super'

/**
 * Server Component wrapper. Carga las notificaciones para la campanita y se
 * las pasa al AppShellClient (que tiene el state de drawer + sidebar
 * colapsable). Las notificaciones solo se consultan para admin/ventas — el
 * operario y el super no las ven, así que evitamos la query en su caso.
 */
export default async function AppShell({
  role,
  userName,
  empresaNombre,
  children,
}: {
  role: Role
  userName: string
  empresaNombre: string | null
  children: React.ReactNode
}) {
  const notificaciones =
    role === 'admin' || role === 'ventas'
      ? await getNotificacionesNoLeidas()
      : []

  return (
    <AppShellClient
      role={role}
      userName={userName}
      empresaNombre={empresaNombre}
      notificaciones={notificaciones}
    >
      {children}
    </AppShellClient>
  )
}
