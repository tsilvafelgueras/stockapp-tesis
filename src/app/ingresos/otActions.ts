'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type OtActionResult = { ok: true } | { ok: false; error: string }

/**
 * Actualiza la OT (partida de tintorería) de un ingreso ya cargado.
 * Es un atributo de la PARTIDA, así que aplica a todos los rollos de ese
 * ingreso. Editable por operario y admin (RLS de `ingresos` lo permite).
 * Se usa desde el detalle del ingreso y desde el detalle de un rollo en stock.
 */
export async function actualizarOtIngreso(
  ingresoId: string,
  ot: string
): Promise<OtActionResult> {
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
    return { ok: false, error: 'No tenés permiso para editar la OT.' }
  }

  const { error } = await supabase
    .from('ingresos')
    .update({ ot: ot.trim() || null })
    .eq('id', ingresoId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/ingresos/${ingresoId}`)
  revalidatePath('/ingresos')
  revalidatePath('/stock')
  return { ok: true }
}
