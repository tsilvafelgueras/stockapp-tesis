import AppShellClient from './AppShellClient'
import { getNotificacionesNoLeidas } from '@/lib/notificaciones'

type Role = 'operario' | 'ventas' | 'admin' | 'super'

/**
 * Server Component wrapper. Carga las notificaciones para la campanita y se
 * las pasa al AppShellClient (que tiene el state de drawer + sidebar
 * colapsable). Las notificaciones solo se consultan para admin/ventas — el
 * operario y el super sin impersonación no las ven. Un super actuando dentro
 * de una empresa SÍ las ve, porque está operando como admin de esa empresa.
 */
export default async function AppShell({
  role,
  userName,
  empresaNombre,
  actuandoComoSuper = false,
  children,
}: {
  role: Role
  userName: string
  empresaNombre: string | null
  actuandoComoSuper?: boolean
  children: React.ReactNode
}) {
  const necesitaNotificaciones =
    role === 'admin' || role === 'ventas' || actuandoComoSuper
  const notificaciones = necesitaNotificaciones
    ? await getNotificacionesNoLeidas()
    : []

  return (
    <AppShellClient
      role={role}
      userName={userName}
      empresaNombre={empresaNombre}
      actuandoComoSuper={actuandoComoSuper}
      notificaciones={notificaciones}
    >
      {children}
    </AppShellClient>
  )
}
