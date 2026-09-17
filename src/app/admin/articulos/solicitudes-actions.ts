'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function solicitarArticulo(nombre: string) {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (!limpio || limpio.length > 150) return { error: 'Ingresá un nombre de hasta 150 caracteres.' }
  const supabase = await createClient()
  // Las RPC validan sesión, empresa y rol dentro de la misma transacción.
  const { data, error } = await supabase.rpc('solicitar_articulo', { p_nombre: limpio })
  if (error) return { error: error.code === 'PGRST202'
    ? 'Falta habilitar las solicitudes de artículos en la base de datos (migración 072).'
    : error.message }
  if (!data || typeof data.id !== 'string' || typeof data.nombre !== 'string' || typeof data.pendiente !== 'boolean') {
    return { error: 'No se pudo obtener el artículo solicitado.' }
  }
  revalidatePath('/admin/articulos')
  revalidatePath('/admin/dashboard')
  return { articulo: data as { id: string; nombre: string; pendiente: boolean } }
}

export async function aprobarSolicitudArticulo(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('aprobar_solicitud_articulo', { p_solicitud_id: id })
  if (error) return { error: error.message }
  revalidatePath('/admin/articulos')
  revalidatePath('/admin/dashboard')
  revalidatePath('/ingresos', 'layout')
  revalidatePath('/notificaciones')
  return { success: true }
}
