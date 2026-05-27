'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ArticuloFormData = {
  nombre: string
  descripcion: string
  stock_minimo_kg?: string
  /** Lista completa de colores asociados al artículo (target state). */
  colores_ids: string[]
}

/**
 * Crea un artículo y asocia los colores recibidos via `articulo_colores`.
 * Validaciones a nivel app: nombre no vacío, al menos un color.
 * Si la combinación (empresa, nombre) ya existe, devuelve error legible.
 */
export async function createArticulo(formData: ArticuloFormData) {
  const supabase = await createClient()

  const nombre = formData.nombre.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (!formData.colores_ids?.length) {
    return { error: 'Asociá al menos un color al artículo.' }
  }

  const { data: articulo, error: aError } = await supabase
    .from('articulos')
    .insert({
      nombre,
      descripcion: formData.descripcion.trim() || null,
      stock_minimo_kg: formData.stock_minimo_kg
        ? parseFloat(formData.stock_minimo_kg)
        : null,
    })
    .select('id')
    .single()

  if (aError || !articulo) {
    if (aError?.code === '23505') {
      return { error: `Ya existe un artículo llamado "${nombre}".` }
    }
    return { error: aError?.message ?? 'No se pudo crear el artículo.' }
  }

  const pivotRows = formData.colores_ids.map((color_id) => ({
    articulo_id: articulo.id,
    color_id,
  }))
  const { error: pError } = await supabase
    .from('articulo_colores')
    .insert(pivotRows)

  if (pError) {
    // Rollback manual: si la pivot falla, el artículo queda huérfano.
    await supabase.from('articulos').delete().eq('id', articulo.id)
    return {
      error: `No se pudieron asociar los colores: ${pError.message}`,
    }
  }

  revalidatePath('/admin/articulos')
  return { success: true }
}

/**
 * Actualiza nombre/descripción/stock y sincroniza la pivot
 * `articulo_colores` con la lista de colores recibida.
 * Calcula diff (altas y bajas) en lugar de borrar+reinsertar para
 * preservar created_at de las relaciones existentes.
 */
export async function updateArticulo(id: string, formData: ArticuloFormData) {
  const supabase = await createClient()

  const nombre = formData.nombre.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (!formData.colores_ids?.length) {
    return { error: 'Asociá al menos un color al artículo.' }
  }

  const { error: uError } = await supabase
    .from('articulos')
    .update({
      nombre,
      descripcion: formData.descripcion.trim() || null,
      stock_minimo_kg: formData.stock_minimo_kg
        ? parseFloat(formData.stock_minimo_kg)
        : null,
    })
    .eq('id', id)

  if (uError) {
    if (uError.code === '23505') {
      return { error: `Ya existe un artículo llamado "${nombre}".` }
    }
    return { error: uError.message }
  }

  // Diff de la pivot.
  const { data: actuales } = await supabase
    .from('articulo_colores')
    .select('color_id')
    .eq('articulo_id', id)

  const setActual = new Set((actuales ?? []).map((r) => r.color_id))
  const setTarget = new Set(formData.colores_ids)

  const aAgregar = [...setTarget].filter((c) => !setActual.has(c))
  const aQuitar = [...setActual].filter((c) => !setTarget.has(c))

  if (aQuitar.length) {
    // Si algún color a quitar está usado por rollos, la FK compuesta
    // (rollos.articulo_id + color_id) impide el delete y Postgres
    // devuelve 23503. Lo traducimos a mensaje legible.
    const { error: dError } = await supabase
      .from('articulo_colores')
      .delete()
      .eq('articulo_id', id)
      .in('color_id', aQuitar)
    if (dError) {
      if (dError.code === '23503') {
        return {
          error:
            'No se puede desasociar un color que ya tiene rollos cargados. Dá de baja esos rollos primero.',
        }
      }
      return { error: dError.message }
    }
  }

  if (aAgregar.length) {
    const rows = aAgregar.map((color_id) => ({ articulo_id: id, color_id }))
    const { error: iError } = await supabase
      .from('articulo_colores')
      .insert(rows)
    if (iError) {
      return { error: `No se pudieron asociar colores: ${iError.message}` }
    }
  }

  revalidatePath('/admin/articulos')
  return { success: true }
}

/**
 * Soft-delete: marca el artículo como inactivo. No borra la fila para
 * preservar referencias históricas (rollos, ingresos lo siguen apuntando).
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
