import { createClient } from '@/lib/supabase/server'

export type Notificacion = {
  id: string
  tipo: 'stock_minimo'
  titulo: string
  mensaje: string
  articulo_id: string | null
  leida_at: string | null
  resuelta_at: string | null
  created_at: string
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

export async function getNotificacionesHistorial(): Promise<Notificacion[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notificaciones')
    .select('id, tipo, titulo, mensaje, articulo_id, leida_at, resuelta_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  return (data ?? []) as Notificacion[]
}
