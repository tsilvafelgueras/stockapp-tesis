'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { normalizarTitleCase } from '@/lib/text/normalize'

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

  // Traer estado y articulo actual para validar transición y permitir
  // resolución de (nombre, color) cuando el bulk cambia solo color.
  const { data: rollos, error: fetchError } = await supabase
    .from('rollos')
    .select('id, estado, articulo_id, articulos ( id, nombre, color )')
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

  // Update común (ubicacion, estado). articulo_id y color reciben
  // tratamiento especial abajo porque tocan el modelo (nombre, color)
  // de articulos.
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

  // Caso 1: cambio explícito de articulo_id (sea con o sin color
  // adicional). El articulo_id apunta a una fila concreta (nombre, color)
  // del catálogo; el trigger sync_rollo_color sincroniza rollos.color.
  // Si vino `changes.color`, lo ignoramos: el color queda determinado
  // por el articulo_id elegido.
  if (changes.articulo_id !== undefined) {
    if (!changes.articulo_id) {
      return { ok: false, error: 'Elegí un artículo válido.' }
    }
    const update = { ...updateCommon, articulo_id: changes.articulo_id }
    const { error } = await supabase
      .from('rollos')
      .update(update)
      .in('id', rolloIds)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/stock')
    revalidatePath('/ingresos')
    return { ok: true, afectados: rolloIds.length }
  }

  // Caso 2: cambio solo de color (sin articulo_id explícito). Cada
  // rollo seleccionado tiene su propio articulo_id (apuntando a una
  // fila (nombre, color_viejo)). Hay que agrupar por nombre,
  // lookup-or-create la fila (nombre, color_nuevo) en articulos, y
  // emitir un UPDATE por grupo reapuntando articulo_id.
  if (changes.color !== undefined) {
    const colorNuevo = normalizarTitleCase(changes.color)
    if (!colorNuevo) {
      return { ok: false, error: 'Elegí un color válido.' }
    }

    // Tipo del resultado del select de arriba (articulos puede venir
    // como array o object según la versión del SDK; lo normalizamos).
    type RolloRow = {
      id: string
      estado: string
      articulo_id: string | null
      articulos: { id: string; nombre: string; color: string } | null
        | Array<{ id: string; nombre: string; color: string }>
    }
    const rollosTyped = rollos as unknown as RolloRow[]

    // Agrupar rollos por nombre de articulo. Si algún rollo no tiene
    // articulo, no podemos resolver el (nombre, color) — error claro.
    const porNombre = new Map<string, string[]>()
    for (const r of rollosTyped) {
      const art = Array.isArray(r.articulos) ? r.articulos[0] : r.articulos
      if (!art) {
        return {
          ok: false,
          error:
            'Hay rollos sin artículo asignado. Asigná el artículo primero y después podés cambiar el color en bulk.',
        }
      }
      const existing = porNombre.get(art.nombre) ?? []
      existing.push(r.id)
      porNombre.set(art.nombre, existing)
    }

    // Lookup-or-create por grupo, después un UPDATE por grupo.
    let afectados = 0
    for (const [nombre, ids] of porNombre.entries()) {
      const { data: existente } = await supabase
        .from('articulos')
        .select('id')
        .eq('nombre', nombre)
        .eq('color', colorNuevo)
        .maybeSingle()
      let articuloIdFinal = existente?.id
      if (!articuloIdFinal) {
        const { data: creado, error: cError } = await supabase
          .from('articulos')
          .insert({ nombre, color: colorNuevo })
          .select('id')
          .single()
        if (cError && cError.code === '23505') {
          const { data: retry } = await supabase
            .from('articulos')
            .select('id')
            .eq('nombre', nombre)
            .eq('color', colorNuevo)
            .maybeSingle()
          articuloIdFinal = retry?.id
        } else if (cError || !creado) {
          return {
            ok: false,
            error: `No se pudo crear "${nombre} ${colorNuevo}": ${cError?.message ?? 'error desconocido'}`,
          }
        } else {
          articuloIdFinal = creado.id
        }
      }
      const update = { ...updateCommon, articulo_id: articuloIdFinal! }
      const { error } = await supabase
        .from('rollos')
        .update(update)
        .in('id', ids)
      if (error) return { ok: false, error: error.message }
      afectados += ids.length
    }

    revalidatePath('/stock')
    revalidatePath('/ingresos')
    return { ok: true, afectados }
  }

  // Caso 3: ni articulo ni color cambian (solo ubicacion/estado).
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
