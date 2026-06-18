import { createClient } from '@/lib/supabase/server'

export type Notificacion = {
  id: string
  tipo:
    | 'stock_minimo'
    | 'solicitud_color'
    | 'ingreso_pendiente'
    | 'pedido_pendiente'
    | 'rollo_liberado'
  titulo: string
  mensaje: string
  articulo_id: string | null
  leida_at: string | null
  resuelta_at: string | null
  created_at: string
  /** Si está, la notificación es un link (no vive en la tabla `notificaciones`). */
  href?: string
  /** false = no se puede marcar como leída (notificación sintética que se
   * autoresuelve sola cuando deja de aplicar). Default true. */
  dismissable?: boolean
}

/**
 * Notificaciones que el badge cuenta: no resueltas + no leídas.
 * Visible para admin + ventas (RLS lo filtra del lado DB).
 */
export async function getNotificacionesNoLeidas(): Promise<Notificacion[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notificaciones')
    .select('id, tipo, titulo, mensaje, articulo_id, leida_at, resuelta_at, created_at')
    .is('resuelta_at', null)
    .is('leida_at', null)
    // 'rollo_liberado' es un aviso dirigido al operario; no ensuciamos la
    // campanita de admin/ventas (que ya generaron la acción).
    .neq('tipo', 'rollo_liberado')
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as Notificacion[]
}

/**
 * Notificaciones activas (no resueltas): incluye leídas y no leídas.
 * Las usamos en el banner de dashboards (siguen apareciendo aunque las hayas
 * abierto, hasta que el stock vuelva a subir).
 */
export async function getNotificacionesActivas(): Promise<Notificacion[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notificaciones')
    .select('id, tipo, titulo, mensaje, articulo_id, leida_at, resuelta_at, created_at')
    .is('resuelta_at', null)
    .order('created_at', { ascending: false })
  return (data ?? []) as Notificacion[]
}

/**
 * Notificaciones sintéticas para el operario (no viven en la tabla
 * `notificaciones`): se calculan en cada carga a partir del estado real del
 * depósito y se autoresuelven solas cuando deja de aplicar la condición
 * (por eso son `dismissable: false`). Cubren las dos tareas del operario:
 * confirmar llegadas y preparar pedidos (picking).
 */
export async function getNotificacionesOperario(): Promise<Notificacion[]> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const notifs: Notificacion[] = []

  const [{ data: rollosPendientes }, { count: pedidosCount }, { data: liberados }] =
    await Promise.all([
      // Ingresos por confirmar = ingresos con al menos un rollo 'pendiente'.
      supabase.from('rollos').select('ingreso_id').eq('estado', 'pendiente'),
      // Pedidos para picking = pendientes o en preparación.
      supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .in('estado', ['pendiente', 'en_preparacion']),
      // Rollos liberados de pedidos por ventas, pendientes de reubicar.
      // Persistidas en la tabla (RLS deja al operario ver solo este tipo).
      supabase
        .from('notificaciones')
        .select('id, tipo, titulo, mensaje, articulo_id, leida_at, resuelta_at, created_at')
        .eq('tipo', 'rollo_liberado')
        .is('resuelta_at', null)
        .is('leida_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

  const ingresosPendientes = new Set(
    ((rollosPendientes ?? []) as { ingreso_id: string }[]).map(
      (r) => r.ingreso_id
    )
  ).size

  if (ingresosPendientes > 0) {
    notifs.push({
      id: 'operario-ingresos-por-confirmar',
      tipo: 'ingreso_pendiente',
      titulo: 'Ingresos por confirmar',
      mensaje: `${ingresosPendientes} ${
        ingresosPendientes === 1
          ? 'ingreso pendiente de confirmar la llegada'
          : 'ingresos pendientes de confirmar la llegada'
      }.`,
      articulo_id: null,
      leida_at: null,
      resuelta_at: null,
      created_at: now,
      href: '/confirmar',
      dismissable: false,
    })
  }

  if (pedidosCount && pedidosCount > 0) {
    notifs.push({
      id: 'operario-pedidos-picking',
      tipo: 'pedido_pendiente',
      titulo: 'Pedidos para picking',
      mensaje: `${pedidosCount} ${
        pedidosCount === 1
          ? 'pedido pendiente de preparar'
          : 'pedidos pendientes de preparar'
      }.`,
      articulo_id: null,
      leida_at: null,
      resuelta_at: null,
      created_at: now,
      href: '/picking',
      dismissable: false,
    })
  }

  // Rollos liberados por ventas: notificación persistida y descartable (el
  // operario la marca leída al reubicar). Linkea al stock filtrado por la
  // ubicación sentinela para encontrarlos rápido.
  for (const n of (liberados ?? []) as Notificacion[]) {
    notifs.unshift({
      ...n,
      href: '/stock?ubicacion=Sin+ubicar',
      dismissable: true,
    })
  }

  return notifs
}

export async function getNotificacionesHistorial(): Promise<Notificacion[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notificaciones')
    .select('id, tipo, titulo, mensaje, articulo_id, leida_at, resuelta_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  return (data ?? []) as Notificacion[]
}
