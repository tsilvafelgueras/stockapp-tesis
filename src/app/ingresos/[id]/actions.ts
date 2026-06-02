'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Guarda (o borra) los kilos de crudo enviados a teñir de una partida.
 * Pasar `kilos = null` limpia el dato. Scopeado por RLS a la empresa del
 * usuario; solo operario/admin (los roles con acceso a ingresos).
 */
export async function setKilosCrudo(
  ingresoId: string,
  kilos: number | null
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autorizado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['operario', 'admin'].includes(profile.role)) {
    return { ok: false, error: 'No tenés permiso para cargar este dato.' }
  }

  if (kilos != null && (!Number.isFinite(kilos) || kilos < 0)) {
    return { ok: false, error: 'Ingresá un número de kilos válido.' }
  }

  const { error } = await supabase
    .from('ingresos')
    .update({
      kilos_crudo_enviado: kilos,
      kilos_crudo_cargado_at: kilos != null ? new Date().toISOString() : null,
      kilos_crudo_cargado_por: kilos != null ? user.id : null,
    })
    .eq('id', ingresoId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/ingresos/${ingresoId}`)
  return { ok: true }
}
