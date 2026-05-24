'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function normalizar(nombre: string): string {
  const limpio = nombre.trim().toLowerCase()
  return limpio.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

export async function createColor(formData: { nombre: string }) {
  const supabase = await createClient()

  const nombre = normalizar(formData.nombre)
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { error } = await supabase.from('colores').insert({ nombre })

  if (error) {
    if (error.code === '23505') {
      return { error: `El color "${nombre}" ya existe.` }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/colores')
  return { success: true }
}

export async function editarColor(id: string, nuevoNombre: string) {
  const supabase = await createClient()

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

  const { error } = await supabase.from('colores').delete().eq('id', id)

  if (error) {
    // 23503 = FK violation. Colores no es FK desde ningún lado hoy
    // (ingresos.color es texto libre), pero por las dudas damos un mensaje
    // legible si Postgres se queja.
    if (error.code === '23503') {
      return {
        error:
          'No se puede eliminar este color porque está vinculado a otros registros.',
      }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/colores')
  return { success: true }
}
