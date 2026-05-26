'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { normalizarTitleCase } from '@/lib/text/normalize'

type ArticuloFormData = {
  nombre: string
  descripcion: string
  color?: string
  stock_minimo_kg?: string
}

export async function createArticulo(formData: ArticuloFormData) {
  const supabase = await createClient()

  const nombre = formData.nombre.trim()
  const color = normalizarTitleCase(formData.color)
  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (!color) return { error: 'El color es obligatorio.' }

  // Lookup-or-create: si ya existe (empresa, nombre, color), reusamos
  // y reportamos como éxito (idempotente). Evita falsos errores cuando
  // dos operarios crean el mismo artículo a la vez.
  const { data: existente } = await supabase
    .from('articulos')
    .select('id')
    .eq('nombre', nombre)
    .eq('color', color)
    .maybeSingle()

  if (existente) {
    revalidatePath('/admin/articulos')
    return { success: true }
  }

  const { error } = await supabase.from('articulos').insert({
    nombre,
    color,
    descripcion: formData.descripcion.trim() || null,
    stock_minimo_kg: formData.stock_minimo_kg
      ? parseFloat(formData.stock_minimo_kg)
      : null,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe el artículo "${nombre} ${color}".` }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/articulos')
  return { success: true }
}

export async function updateArticulo(id: string, formData: ArticuloFormData) {
  const supabase = await createClient()

  const nombre = formData.nombre.trim()
  const color = normalizarTitleCase(formData.color)
  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (!color) return { error: 'El color es obligatorio.' }

  const { error } = await supabase
    .from('articulos')
    .update({
      nombre,
      color,
      descripcion: formData.descripcion.trim() || null,
      stock_minimo_kg: formData.stock_minimo_kg
        ? parseFloat(formData.stock_minimo_kg)
        : null,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe el artículo "${nombre} ${color}".` }
    }
    return { error: error.message }
  }

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
