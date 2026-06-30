import AppShellClient from './AppShellClient'
import {
  getNotificacionesNoLeidas,
  getNotificacionesOperario,
  type Notificacion,
} from '@/lib/notificaciones'
import { createClient } from '@/lib/supabase/server'

type Role = 'operario' | 'ventas' | 'admin' | 'super'

/**
 * Server Component wrapper. Carga las notificaciones para la campanita y se
 * las pasa al AppShellClient (que tiene el state de drawer + sidebar
 * colapsable). Admin/ventas ven las notificaciones de la tabla; el operario
 * ve avisos sintéticos de sus tareas (ingresos por confirmar y pedidos para
 * picking). El super no ve campanita, así que evitamos la query en su caso.
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
  const notificaciones: Notificacion[] =
    role === 'admin' || role === 'ventas'
      ? await getNotificacionesNoLeidas()
      : role === 'operario'
        ? await getNotificacionesOperario()
        : []

  // El admin además ve una notificación de "verificar colores" mientras haya
  // solicitudes de color pendientes. Es sintética (no vive en la tabla): se
  // autoresuelve cuando el admin las aprueba/rechaza, y linkea a /admin/colores.
  if (role === 'admin') {
    const supabase = await createClient()
    const { count } = await supabase
      .from('solicitudes_color')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
    if (count && count > 0) {
      notificaciones.unshift({
        id: 'solicitudes-color-pendientes',
        tipo: 'solicitud_color',
        titulo: 'Verificar colores',
        mensaje: `${count} ${
          count === 1
            ? 'color pendiente de verificación'
            : 'colores pendientes de verificación'
        }. Revisalos para aprobarlos o rechazarlos.`,
        articulo_id: null,
        leida_at: null,
        resuelta_at: null,
        created_at: new Date().toISOString(),
        href: '/admin/colores',
        dismissable: false,
      })
    }
  }

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
