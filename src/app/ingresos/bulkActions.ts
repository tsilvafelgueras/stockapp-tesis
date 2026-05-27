'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type BulkEditChanges = {
  ubicacion?: string | null
  estado?: 'en_stock' | 'segunda' | 'baja' | 'pendiente'
  articulo_id?: string
  /** ID del color en el catálogo `colores`. Debe estar asociado al artículo
   * de cada rollo en `articulo_colores`. */
  color_id?: string
}

export type BulkEditResult =
  | { ok: true; afectados: number }
  | { ok: false; error: string }

/**
 * Edita varios rollos a la vez. Solo permite cambiar campos seguros
 * (ubicación, estado libre, artículo, color). Estados `reservado` y
 * `entregado` NO se pueden modificar por bulk porque dependen del flow
 * de pedidos/picking.
 *
 * Operario y admin pueden mover ubicación/estado/color/articulo;
 * solo admin puede dar de baja.
 */
export async function bulkEditRollos(
  rolloIds: string[],
  changes: BulkEditChanges
): Promise<BulkEditResult> {
  if (!rolloIds.length) {
    return { ok: false, error: 'No seleccionaste ningún rollo.' }
  }
  if (
    changes.ubicacion === undefined &&
    changes.estado === undefined &&
    changes.articulo_id === undefined &&
    changes.color_id === undefined
  ) {
    return { ok: false, error: 'No definiste qué cambiar.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Tu sesión expiró. Volvé a entrar.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  if (role !== 'operario' && role !== 'admin') {
    return {
      ok: false,
      error: 'Solo el operario o el admin pueden editar rollos en bulk.',
    }
  }

  if (changes.estado === 'baja' && role !== 'admin') {
    return {
      ok: false,
      error: 'Solo el administrador puede dar de baja rollos.',
    }
  }

  const { data: rollos, error: fetchError } = await supabase
    .from('rollos')
    .select('id, estado, articulo_id, color_id')
    .in('id', rolloIds)

  if (fetchError) return { ok: false, error: fetchError.message }
  if (!rollos || rollos.length === 0) {
    return { ok: false, error: 'No se encontraron los rollos seleccionados.' }
  }

  for (const r of rollos) {
    if (changes.estado !== undefined) {
      if (r.estado === 'reservado' || r.estado === 'entregado') {
        return {
          ok: false,
          error: `El rollo está en estado "${r.estado}" y no se puede cambiar en bulk. Liberalo o cancelá el pedido primero.`,
        }
      }
    }
    if (changes.ubicacion !== undefined) {
      if (r.estado === 'baja' || r.estado === 'entregado') {
        return {
          ok: false,
          error: 'Hay rollos dados de baja o entregados; no se les puede cambiar la ubicación.',
        }
      }
    }
  }

  // Construir update común (campos directos).
  const updateCommon: Record<string, unknown> = {}
  if (changes.ubicacion !== undefined) {
    const ubic = changes.ubicacion?.trim() ?? ''
    if (changes.ubicacion !== null && !ubic) {
      return { ok: false, error: 'La ubicación no puede estar vacía.' }
    }
    updateCommon.ubicacion = ubic || null
  }
  if (changes.estado !== undefined) {
    updateCommon.estado = changes.estado
  }
  if (changes.articulo_id !== undefined) {
    if (!changes.articulo_id) {
      return { ok: false, error: 'Elegí un artículo válido.' }
    }
    updateCommon.articulo_id = changes.articulo_id
  }

  // Cambio de color: validar que la combinación (articulo, color) exista
  // en la pivot `articulo_colores` para cada rollo afectado. La FK
  // compuesta lo enforce a nivel BD; acá validamos antes para devolver
  // un error legible en lugar de el código 23503 de Postgres.
  if (changes.color_id !== undefined) {
    if (!changes.color_id) {
      return { ok: false, error: 'Elegí un color válido.' }
    }
    const articulosTarget = new Set<string>()
    for (const r of rollos) {
      const articuloId =
        changes.articulo_id ?? (r.articulo_id as string | null)
      if (!articuloId) {
        return {
          ok: false,
          error:
            'Hay rollos sin artículo asignado. Asigná artículo y color juntos en un solo cambio.',
        }
      }
      articulosTarget.add(articuloId)
    }
    const { data: asociaciones } = await supabase
      .from('articulo_colores')
      .select('articulo_id')
      .eq('color_id', changes.color_id)
      .in('articulo_id', [...articulosTarget])
    const articulosCubiertos = new Set(
      (asociaciones ?? []).map((a) => a.articulo_id)
    )
    const faltantes = [...articulosTarget].filter(
      (a) => !articulosCubiertos.has(a)
    )
    if (faltantes.length) {
      return {
        ok: false,
        error:
          'El color elegido no está asociado a alguno de los artículos. Pedile al admin que lo asocie en el catálogo de artículos.',
      }
    }
    updateCommon.color_id = changes.color_id
  }

  if (Object.keys(updateCommon).length === 0) {
    return { ok: false, error: 'No definiste qué cambiar.' }
  }

  const { error } = await supabase
    .from('rollos')
    .update(updateCommon)
    .in('id', rolloIds)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/stock')
  revalidatePath('/ingresos')

  return { ok: true, afectados: rolloIds.length }
}
