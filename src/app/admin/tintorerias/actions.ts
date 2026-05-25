'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { success: true } | { error: string }

export type TintoreriaInput = {
  nombre: string
  contacto?: string
  email?: string
  telefono?: string
}

function clean(v: string | undefined | null): string | null {
  if (v == null) return null
  const t = v.trim()
  return t === '' ? null : t
}

export async function createTintoreria(
  formData: TintoreriaInput
): Promise<ActionResult> {
  const supabase = await createClient()

  const nombre = formData.nombre.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { error } = await supabase.from('tintorerias').insert({
    nombre,
    activo: true,
    fecha_baja: null,
    contacto: clean(formData.contacto),
    email: clean(formData.email),
    telefono: clean(formData.telefono),
  })

  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe una tintorería con el nombre "${nombre}".` }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/tintorerias')
  return { success: true }
}

export async function editarTintoreria(
  id: string,
  cambios: TintoreriaInput
): Promise<ActionResult> {
  const supabase = await createClient()

  const nombre = cambios.nombre.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { error } = await supabase
    .from('tintorerias')
    .update({
      nombre,
      contacto: clean(cambios.contacto),
      email: clean(cambios.email),
      telefono: clean(cambios.telefono),
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe una tintorería con el nombre "${nombre}".` }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/tintorerias')
  return { success: true }
}

export async function darDeBajaTintoreria(
  id: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tintorerias')
    .update({ activo: false, fecha_baja: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/tintorerias')
  return { success: true }
}

export async function reactivarTintoreria(
  id: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tintorerias')
    .update({ activo: true, fecha_baja: null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/tintorerias')
  return { success: true }
}

export async function eliminarTintoreria(
  id: string
): Promise<ActionResult> {
  const supabase = await createClient()

  // Si tiene ingresos asociados, el delete falla por FK. Damos un mensaje
  // claro y empujamos al usuario a dar de baja en lugar de eliminar.
  const { count, error: countError } = await supabase
    .from('ingresos')
    .select('id', { count: 'exact', head: true })
    .eq('tintoreria_id', id)

  if (countError) return { error: countError.message }
  if ((count ?? 0) > 0) {
    return {
      error:
        'No se puede eliminar: la tintorería tiene ingresos asociados. Dale de baja en su lugar.',
    }
  }

  const { error } = await supabase.from('tintorerias').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return {
        error:
          'No se puede eliminar: la tintorería tiene registros vinculados. Dale de baja en su lugar.',
      }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/tintorerias')
  return { success: true }
}
