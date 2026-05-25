'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { success: true } | { error: string }

export type RelacionInput = {
  contacto?: string
  email?: string
  telefono?: string
}

function clean(v: string | undefined | null): string | null {
  if (v == null) return null
  const t = v.trim()
  return t === '' ? null : t
}

async function getEmpresaId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id, role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return null
  return profile?.empresa_id ?? null
}

/**
 * Asocia una tintorería pura existente a la empresa del admin actual.
 * El registro maestro de tintorerías (nombre, prompt, reader_type) lo
 * mantiene el superadmin. Si la tintorería que buscás no aparece en la
 * lista, hay que pedirle al super que la cree.
 */
export async function asociarTintoreria(
  tintoreriaId: string,
  data: RelacionInput
): Promise<ActionResult> {
  const supabase = await createClient()
  const empresaId = await getEmpresaId()
  if (!empresaId) return { error: 'No autorizado.' }

  if (!tintoreriaId) return { error: 'Elegí una tintorería.' }

  const { error } = await supabase.from('empresa_tintorerias').insert({
    empresa_id: empresaId,
    tintoreria_id: tintoreriaId,
    contacto: clean(data.contacto),
    email: clean(data.email),
    telefono: clean(data.telefono),
    activo: true,
    fecha_baja: null,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Esta tintorería ya está asociada a tu empresa.' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/tintorerias')
  return { success: true }
}

export async function editarRelacionTintoreria(
  tintoreriaId: string,
  cambios: RelacionInput
): Promise<ActionResult> {
  const supabase = await createClient()
  const empresaId = await getEmpresaId()
  if (!empresaId) return { error: 'No autorizado.' }

  const { error } = await supabase
    .from('empresa_tintorerias')
    .update({
      contacto: clean(cambios.contacto),
      email: clean(cambios.email),
      telefono: clean(cambios.telefono),
    })
    .eq('empresa_id', empresaId)
    .eq('tintoreria_id', tintoreriaId)

  if (error) return { error: error.message }

  revalidatePath('/admin/tintorerias')
  return { success: true }
}

export async function darDeBajaTintoreria(
  tintoreriaId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const empresaId = await getEmpresaId()
  if (!empresaId) return { error: 'No autorizado.' }

  const { error } = await supabase
    .from('empresa_tintorerias')
    .update({ activo: false, fecha_baja: new Date().toISOString() })
    .eq('empresa_id', empresaId)
    .eq('tintoreria_id', tintoreriaId)

  if (error) return { error: error.message }

  revalidatePath('/admin/tintorerias')
  return { success: true }
}

export async function reactivarTintoreria(
  tintoreriaId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const empresaId = await getEmpresaId()
  if (!empresaId) return { error: 'No autorizado.' }

  const { error } = await supabase
    .from('empresa_tintorerias')
    .update({ activo: true, fecha_baja: null })
    .eq('empresa_id', empresaId)
    .eq('tintoreria_id', tintoreriaId)

  if (error) return { error: error.message }

  revalidatePath('/admin/tintorerias')
  return { success: true }
}

/**
 * Quita el link entre la empresa y la tintorería. No borra la tintorería
 * pura (puede seguir en uso por otras empresas). Si hay ingresos de esta
 * tintorería en la empresa, falla y empuja al usuario a dar de baja.
 */
export async function desasociarTintoreria(
  tintoreriaId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const empresaId = await getEmpresaId()
  if (!empresaId) return { error: 'No autorizado.' }

  const { count, error: countError } = await supabase
    .from('ingresos')
    .select('id', { count: 'exact', head: true })
    .eq('tintoreria_id', tintoreriaId)
    .eq('empresa_id', empresaId)

  if (countError) return { error: countError.message }
  if ((count ?? 0) > 0) {
    return {
      error:
        'No se puede desasociar: la tintorería tiene ingresos cargados en esta empresa. Dale de baja en su lugar.',
    }
  }

  const { error } = await supabase
    .from('empresa_tintorerias')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('tintoreria_id', tintoreriaId)

  if (error) return { error: error.message }

  revalidatePath('/admin/tintorerias')
  return { success: true }
}
