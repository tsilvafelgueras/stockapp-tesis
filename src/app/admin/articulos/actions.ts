'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createArticulo(formData: {
  nombre: string
  descripcion: string
  stock_minimo_kg?: string
}) {
  const supabase = await createClient()

  const nombre = formData.nombre.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { error } = await supabase.from('articulos').insert({
    nombre,
    descripcion: formData.descripcion.trim() || null,
    stock_minimo_kg: formData.stock_minimo_kg
      ? parseFloat(formData.stock_minimo_kg)
      : null,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/articulos')
  return { success: true }
}

export async function updateArticulo(
  id: string,
  formData: { nombre: string; descripcion: string; stock_minimo_kg?: string }
) {
  const supabase = await createClient()

  const nombre = formData.nombre.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { error } = await supabase
    .from('articulos')
    .update({
      nombre,
      descripcion: formData.descripcion.trim() || null,
      stock_minimo_kg: formData.stock_minimo_kg
        ? parseFloat(formData.stock_minimo_kg)
        : null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/articulos')
  return { success: true }
}

/**
 * Soft-delete: marca el artículo como inactivo. No borra la fila para
 * preservar referencias históricas (rollos, ingresos, pedidos lo siguen
 * apuntando). La lista principal filtra por activo=true, así desaparece
 * de la UI sin perder trazabilidad.
 */
export async function deleteArticulo(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('articulos')
    .update({ activo: false })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/articulos')
  return { success: true }
}
