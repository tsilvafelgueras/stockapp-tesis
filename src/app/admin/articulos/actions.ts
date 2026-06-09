'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ArticuloFormData = {
  nombre: string
  descripcion: string
  stock_minimos_por_color?: Record<string, string>
  colores_ids: string[]
  /** ids de colores fijados (pin) para este artículo. */
  fijados_color_ids?: string[]
}

type CrearArticuloData = {
  nombre: string
  descripcion: string
}

export async function createArticulo(formData: CrearArticuloData) {
  const supabase = await createClient()

  const nombre = formData.nombre.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { error: aError } = await supabase
    .from('articulos')
    .insert({
      nombre,
      descripcion: formData.descripcion.trim() || null,
      stock_minimo_kg: null,
    })

  if (aError) {
    if (aError.code === '23505') {
      return { error: `Ya existe un articulo llamado "${nombre}".` }
    }
    return { error: aError.message }
  }

  revalidatePath('/admin/articulos')
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function updateArticulo(id: string, formData: ArticuloFormData) {
  const supabase = await createClient()

  const nombre = formData.nombre.trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (!formData.colores_ids?.length) {
    return { error: 'Asocia al menos un color al articulo.' }
  }

  const { error: uError } = await supabase
    .from('articulos')
    .update({
      nombre,
      descripcion: formData.descripcion.trim() || null,
      stock_minimo_kg: null,
    })
    .eq('id', id)

  if (uError) {
    if (uError.code === '23505') {
      return { error: `Ya existe un articulo llamado "${nombre}".` }
    }
    return { error: uError.message }
  }

  const { data: actuales } = await supabase
    .from('articulo_colores')
    .select('color_id')
    .eq('articulo_id', id)

  const setActual = new Set((actuales ?? []).map((r) => r.color_id))
  const setTarget = new Set(formData.colores_ids)

  const aAgregar = [...setTarget].filter((c) => !setActual.has(c))
  const aQuitar = [...setActual].filter((c) => !setTarget.has(c))

  if (aQuitar.length) {
    const { error: dError } = await supabase
      .from('articulo_colores')
      .delete()
      .eq('articulo_id', id)
      .in('color_id', aQuitar)
    if (dError) {
      if (dError.code === '23503') {
        return {
          error:
            'No se puede desasociar un color que ya tiene rollos cargados. Da de baja esos rollos primero.',
        }
      }
      return { error: dError.message }
    }
  }

  const fijados = new Set(formData.fijados_color_ids ?? [])

  if (aAgregar.length) {
    const rows = aAgregar.map((color_id) => ({
      articulo_id: id,
      color_id,
      stock_minimo_kg: parseStockMinimo(
        formData.stock_minimos_por_color?.[color_id]
      ),
      fijado: fijados.has(color_id),
    }))
    const { error: iError } = await supabase
      .from('articulo_colores')
      .insert(rows)
    if (iError) {
      return { error: `No se pudieron asociar colores: ${iError.message}` }
    }
  }

  for (const color_id of formData.colores_ids) {
    const { error: sError } = await supabase
      .from('articulo_colores')
      .update({
        stock_minimo_kg: parseStockMinimo(
          formData.stock_minimos_por_color?.[color_id]
        ),
        fijado: fijados.has(color_id),
      })
      .eq('articulo_id', id)
      .eq('color_id', color_id)
    if (sError) return { error: sError.message }
  }

  revalidatePath('/admin/articulos')
  revalidatePath('/admin/dashboard')
  return { success: true }
}

export async function deleteArticulo(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('articulos')
    .update({ activo: false })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/articulos')
  revalidatePath('/admin/dashboard')
  return { success: true }
}

function parseStockMinimo(value: string | undefined): number | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}
