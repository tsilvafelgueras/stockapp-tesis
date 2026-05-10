'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type StockActionResult = { ok: true } | { ok: false; error: string }

export async function moverUbicacion(
  rolloId: string,
  ubicacion: string
): Promise<StockActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Tu sesión expiró. Volvé a entrar.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'operario' && profile?.role !== 'admin') {
    return {
      ok: false,
      error: 'Solo el operario o el admin pueden mover ubicación.',
    }
  }

  const ubic = ubicacion.trim()
  if (!ubic) return { ok: false, error: 'La ubicación no puede estar vacía.' }
  if (ubic.length > 50) {
    return { ok: false, error: 'La ubicación es demasiado larga (máx. 50).' }
  }

  // RLS filtra por empresa, así que si no aparece es porque no es de esta empresa
  const { data: rollo, error: fetchError } = await supabase
    .from('rollos')
    .select('id, estado')
    .eq('id', rolloId)
    .single()

  if (fetchError || !rollo) {
    return { ok: false, error: 'No se encontró el rollo.' }
  }
  if (rollo.estado === 'baja' || rollo.estado === 'entregado') {
    return {
      ok: false,
      error:
        'No se puede mover un rollo dado de baja o ya entregado al cliente.',
    }
  }

  const { error } = await supabase
    .from('rollos')
    .update({ ubicacion: ubic })
    .eq('id', rolloId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/stock')
  return { ok: true }
}

export async function darDeBajaRollo(
  rolloId: string
): Promise<StockActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Tu sesión expiró. Volvé a entrar.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return {
      ok: false,
      error: 'Solo el administrador puede dar de baja rollos.',
    }
  }

  const { data: rollo, error: fetchError } = await supabase
    .from('rollos')
    .select('id, estado')
    .eq('id', rolloId)
    .single()

  if (fetchError || !rollo) {
    return { ok: false, error: 'No se encontró el rollo.' }
  }
  if (rollo.estado === 'baja') {
    return { ok: false, error: 'El rollo ya está dado de baja.' }
  }
  if (rollo.estado === 'reservado' || rollo.estado === 'entregado') {
    return {
      ok: false,
      error:
        'No se puede dar de baja un rollo reservado o entregado. Liberalo primero.',
    }
  }

  const { error } = await supabase
    .from('rollos')
    .update({ estado: 'baja' })
    .eq('id', rolloId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/stock')
  return { ok: true }
}
