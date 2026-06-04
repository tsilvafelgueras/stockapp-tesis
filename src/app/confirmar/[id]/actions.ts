'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ConfirmarRolloResult =
  | {
      ok: true
      rollo: { id: string; numero_pieza: string }
      ingresoCompleto: boolean
    }
  | {
      ok: false
      error: string
      codigo: 'NO_MATCH' | 'YA_CONFIRMADO' | 'DB_ERROR'
    }

export async function confirmarRollo(
  ingresoId: string,
  textoEscaneado: string,
  ubicacion: string
): Promise<ConfirmarRolloResult> {
  const supabase = await createClient()

  const { data: rollos, error: fetchError } = await supabase
    .from('rollos')
    .select('id, numero_pieza, estado')
    .eq('ingreso_id', ingresoId)
    .order('numero_pieza')

  if (fetchError || !rollos?.length) {
    return {
      ok: false,
      error: 'Este código no pertenece a este ingreso.',
      codigo: 'NO_MATCH',
    }
  }

  const numeroPieza = textoEscaneado.trim()
  const rollo = rollos.find((r) => r.numero_pieza === numeroPieza)

  if (!rollo) {
    return {
      ok: false,
      error: 'Este código no pertenece a este ingreso.',
      codigo: 'NO_MATCH',
    }
  }

  if (rollo.estado !== 'pendiente') {
    return {
      ok: false,
      error: `El rollo ${rollo.numero_pieza} ya fue confirmado.`,
      codigo: 'YA_CONFIRMADO',
    }
  }

  const { error: updateError } = await supabase
    .from('rollos')
    .update({ estado: 'en_stock', ubicacion: ubicacion.trim() || null })
    .eq('id', rollo.id)

  if (updateError) {
    return { ok: false, error: updateError.message, codigo: 'DB_ERROR' }
  }

  const { count } = await supabase
    .from('rollos')
    .select('id', { count: 'exact', head: true })
    .eq('ingreso_id', ingresoId)
    .eq('estado', 'pendiente')

  const ingresoCompleto = count === 0

  if (ingresoCompleto) {
    await supabase
      .from('ingresos')
      .update({ estado: 'confirmado' })
      .eq('id', ingresoId)
  }

  revalidatePath(`/confirmar/${ingresoId}`)
  revalidatePath('/confirmar')

  return {
    ok: true,
    rollo: { id: rollo.id, numero_pieza: rollo.numero_pieza },
    ingresoCompleto,
  }
}

// ── Confirmar partida por conteo (flujo nuevo) ───────────────
//
// El operario cuenta físicamente cuántos rollos llegaron e ingresa
// ese número en lugar de escanear cada QR. Validamos el conteo contra
// la planilla (cantidad de rollos extraídos Y total declarado). Si
// coincide, confirmamos toda la partida; si no, exigimos una nota y
// confirmamos igual (la diferencia queda como traza para reclamar a
// la tintorería).

export type RolloOverride = {
  id: string
  ubicacion?: string | null
  comentario?: string | null
}

export type ConfirmarPartidaInput = {
  conteoFisico: number
  ubicacionGeneral: string | null
  /** Requerida cuando el conteo no coincide con la planilla. */
  nota: string | null
  overrides: RolloOverride[]
}

export type ConfirmarPartidaResult =
  | { ok: true; confirmados: number }
  | {
      ok: false
      error: string
      codigo: 'DISCREPANCIA' | 'SIN_PENDIENTES' | 'NO_AUTORIZADO' | 'DB_ERROR'
      /** Presente cuando codigo === 'DISCREPANCIA'. */
      detalle?: { contado: number; filas: number; declarado: number | null }
    }

export async function confirmarPartida(
  ingresoId: string,
  input: ConfirmarPartidaInput
): Promise<ConfirmarPartidaResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      error: 'Tu sesión expiró. Volvé a entrar.',
      codigo: 'NO_AUTORIZADO',
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'operario' && profile?.role !== 'admin') {
    return {
      ok: false,
      error: 'Solo el operario o el admin pueden confirmar llegadas.',
      codigo: 'NO_AUTORIZADO',
    }
  }

  const { data: ingreso, error: ingError } = await supabase
    .from('ingresos')
    .select('id, total_rollos_declarado, estado')
    .eq('id', ingresoId)
    .single()

  if (ingError || !ingreso) {
    return { ok: false, error: 'No se encontró el ingreso.', codigo: 'DB_ERROR' }
  }

  const { data: pendientes, error: rollosError } = await supabase
    .from('rollos')
    .select('id, numero_pieza')
    .eq('ingreso_id', ingresoId)
    .eq('estado', 'pendiente')

  if (rollosError) {
    return { ok: false, error: rollosError.message, codigo: 'DB_ERROR' }
  }
  if (!pendientes?.length) {
    return {
      ok: false,
      error: 'Esta partida ya no tiene rollos pendientes de confirmar.',
      codigo: 'SIN_PENDIENTES',
    }
  }

  const filas = pendientes.length
  const declarado = ingreso.total_rollos_declarado
  // Comparamos contra los rollos PENDIENTES, no contra el total declarado:
  // la partida puede estar confirmada a medias (scanner viejo), así que lo que
  // se cuenta ahora es lo que falta. El total declarado queda informativo.
  const coincide = input.conteoFisico === filas

  // Si hay discrepancia y no nos dieron una nota, no confirmamos:
  // devolvemos los números para que la UI muestre la alerta.
  if (!coincide && !input.nota?.trim()) {
    return {
      ok: false,
      error:
        'El conteo no coincide con la planilla. Verificá de nuevo o dejá una nota para confirmar igual.',
      codigo: 'DISCREPANCIA',
      detalle: { contado: input.conteoFisico, filas, declarado },
    }
  }

  const ubicacionGeneral = input.ubicacionGeneral?.trim() || null
  const overridesPorId = new Map(input.overrides.map((o) => [o.id, o]))

  // Actualizamos cada rollo pendiente: pasa a en_stock, toma la
  // ubicación de la partida (salvo override) y el comentario puntual.
  for (const rollo of pendientes) {
    const override = overridesPorId.get(rollo.id)
    const ubicacion =
      override?.ubicacion?.trim() || ubicacionGeneral
    const comentario = override?.comentario?.trim() || null

    const { error: updError } = await supabase
      .from('rollos')
      .update({ estado: 'en_stock', ubicacion, comentario })
      .eq('id', rollo.id)
      .eq('estado', 'pendiente')

    if (updError) {
      return { ok: false, error: updError.message, codigo: 'DB_ERROR' }
    }
  }

  const { error: ingUpdError } = await supabase
    .from('ingresos')
    .update({
      estado: 'confirmado',
      conteo_fisico: input.conteoFisico,
      conteo_nota: coincide ? null : input.nota?.trim() || null,
    })
    .eq('id', ingresoId)

  if (ingUpdError) {
    return { ok: false, error: ingUpdError.message, codigo: 'DB_ERROR' }
  }

  revalidatePath(`/confirmar/${ingresoId}`)
  revalidatePath('/confirmar')
  revalidatePath('/ingresos')
  revalidatePath('/stock')

  return { ok: true, confirmados: filas }
}
