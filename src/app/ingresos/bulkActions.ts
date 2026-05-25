'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type BulkEditChanges = {
  ubicacion?: string | null
  estado?: 'en_stock' | 'segunda' | 'baja' | 'pendiente'
  articulo_id?: string
  color?: string
}

export type BulkEditResult =
  | { ok: true; afectados: number }
  | { ok: false; error: string }

/**
 * Edita varios rollos a la vez. Solo permite cambiar campos seguros
 * (ubicación, estado libre, artículo). Estados `reservado` y `entregado`
 * NO se pueden modificar por bulk porque dependen del flow de pedidos/picking.
 *
 * Operario y admin pueden mover ubicación y estado; solo admin puede dar de baja.
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
    changes.color === undefined
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

  // Traer estado actual para validar la transición de cada rollo.
  const { data: rollos, error: fetchError } = await supabase
    .from('rollos')
    .select('id, estado')
    .in('id', rolloIds)

  if (fetchError) return { ok: false, error: fetchError.message }
  if (!rollos || rollos.length === 0) {
    return { ok: false, error: 'No se encontraron los rollos seleccionados.' }
  }

  for (const r of rollos) {
    if (changes.estado !== undefined) {
      // Bloqueamos cambios masivos sobre rollos atados a flow de pedidos.
      if (r.estado === 'reservado' || r.estado === 'entregado') {
        return {
          ok: false,
          error: `El rollo está en estado "${r.estado}" y no se puede cambiar en bulk. Liberalo o canceá el pedido primero.`,
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

  const update: Record<string, unknown> = {}
  if (changes.ubicacion !== undefined) {
    const ubic = changes.ubicacion?.trim() ?? ''
    if (changes.ubicacion !== null && !ubic) {
      return { ok: false, error: 'La ubicación no puede estar vacía.' }
    }
    update.ubicacion = ubic || null
  }
  if (changes.estado !== undefined) {
    update.estado = changes.estado
  }
  if (changes.articulo_id !== undefined) {
    if (!changes.articulo_id) {
      return { ok: false, error: 'Elegí un artículo válido.' }
    }
    update.articulo_id = changes.articulo_id
  }
  if (changes.color !== undefined) {
    const colorClean = changes.color.trim()
    if (!colorClean) {
      return { ok: false, error: 'Elegí un color válido.' }
    }
    update.color = colorClean
  }

  const { error } = await supabase
    .from('rollos')
    .update(update)
    .in('id', rolloIds)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/stock')
  revalidatePath('/ingresos')

  return { ok: true, afectados: rolloIds.length }
}
