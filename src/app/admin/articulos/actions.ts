'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ArticuloFormData = {
  nombre: string
  descripcion: string
  color?: string
  stock_minimo_kg?: string
}

/**
 * Sentence case: trim + primera letra mayúscula, resto minúscula.
 * "BLANCO" → "Blanco"
 * "  blanco  " → "Blanco"
 * "AZUL MARINO" → "Azul marino"
 * Devuelve null si el input queda vacío después del trim.
 */
function normalizarColor(raw: string | undefined | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

export async function createArticulo(formData: ArticuloFormData) {
  const supabase = await createClient()

  const nombre = formData.nombre.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { error } = await supabase.from('articulos').insert({
    nombre,
    descripcion: formData.descripcion.trim() || null,
    color: normalizarColor(formData.color),
    stock_minimo_kg: formData.stock_minimo_kg
      ? parseFloat(formData.stock_minimo_kg)
      : null,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/articulos')
  return { success: true }
}

export async function updateArticulo(id: string, formData: ArticuloFormData) {
  const supabase = await createClient()

  const nombre = formData.nombre.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { error } = await supabase
    .from('articulos')
    .update({
      nombre,
      descripcion: formData.descripcion.trim() || null,
      color: normalizarColor(formData.color),
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
