'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function normalizar(nombre: string): string {
  const limpio = nombre.trim().toLowerCase()
  return limpio.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

async function getCallerRole(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return profile?.role ?? null
}

/**
 * Solo admin. Operario/ventas usan `solicitarColor` (workflow).
 */
export async function createColor(formData: { nombre: string }) {
  const supabase = await createClient()

  const role = await getCallerRole()
  if (role !== 'admin') {
    return {
      error:
        'Solo el administrador puede crear colores. Pedile que cree el color o usá "Solicitar color" desde un formulario.',
    }
  }

  const nombre = normalizar(formData.nombre)
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { data, error } = await supabase
    .from('colores')
    .insert({ nombre })
    .select('id, nombre')
    .single()

  if (error) {
    // Si ya existe, lo devolvemos igual para que el caller (ej. el form de
    // ingreso) pueda seleccionarlo sin fricción en vez de mostrar un error.
    if (error.code === '23505') {
      const { data: existente } = await supabase
        .from('colores')
        .select('id, nombre')
        .eq('nombre', nombre)
        .maybeSingle()
      if (existente) return { success: true, color: existente, alreadyExists: true }
      return { error: `El color "${nombre}" ya existe.` }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/colores')
  return { success: true, color: data }
}

export async function editarColor(id: string, nuevoNombre: string) {
  const supabase = await createClient()

  const role = await getCallerRole()
  if (role !== 'admin') {
    return { error: 'Solo el administrador puede editar colores.' }
  }

  const nombre = normalizar(nuevoNombre)
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { error } = await supabase
    .from('colores')
    .update({ nombre })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: `El color "${nombre}" ya existe.` }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/colores')
  return { success: true }
}

export async function eliminarColor(id: string) {
  const supabase = await createClient()

  const role = await getCallerRole()
  if (role !== 'admin') {
    return { error: 'Solo el administrador puede eliminar colores.' }
  }

  const { error } = await supabase.from('colores').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return {
        error:
          'No se puede eliminar este color porque está vinculado a artículos o rollos.',
      }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/colores')
  return { success: true }
}

// ── Workflow de solicitudes de color ──────────────────────────

/**
 * Crea una solicitud pendiente. Cualquier rol autenticado puede llamar:
 * la RLS valida que `solicitado_por = auth.uid()` y `estado = 'pendiente'`.
 *
 * Devuelve `existing` cuando ya hay una solicitud pendiente con el mismo
 * nombre, para que la UI muestre "tu admin todavía no la aprobó".
 */
export async function solicitarColor(input: { nombre: string; motivo?: string }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión expirada — volvé a iniciar sesión.' }

  const nombre = normalizar(input.nombre)
  if (!nombre) return { error: 'El nombre no puede estar vacío.' }

  // Si el color YA existe en el catálogo, no hace falta solicitud.
  const { data: yaExiste } = await supabase
    .from('colores')
    .select('id, nombre')
    .eq('nombre', nombre)
    .maybeSingle()
  if (yaExiste) {
    return { alreadyExists: true, color: yaExiste }
  }

  // Si ya hay una solicitud pendiente con ese nombre, no duplicar.
  const { data: pendiente } = await supabase
    .from('solicitudes_color')
    .select('id, nombre_solicitado')
    .eq('estado', 'pendiente')
    .ilike('nombre_solicitado', nombre)
    .maybeSingle()
  if (pendiente) {
    return { alreadyPending: true, solicitudId: pendiente.id }
  }

  const { data, error } = await supabase
    .from('solicitudes_color')
    .insert({
      nombre_solicitado: nombre,
      motivo: input.motivo?.trim() || null,
      solicitado_por: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/colores')
  return { success: true, solicitudId: data.id }
}

export async function aprobarSolicitudColor(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('aprobar_solicitud_color', {
    p_solicitud_id: id,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/colores')
  return { success: true, colorId: data as string }
}

export async function rechazarSolicitudColor(id: string, motivo: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('rechazar_solicitud_color', {
    p_solicitud_id: id,
    p_motivo: motivo,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/colores')
  return { success: true }
}
