'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PickearRolloResult =
  | {
      ok: true
      rolloId: string
      numeroPieza: string
      kilos: number | null
      ubicacion: string | null
      articuloId: string | null
      colorId: string | null
      pedidoPartidaId: string
      partidaRealLote: string | null
      partidaSolicitadaLote: string | null
      esSustitucionPartida: boolean
      pendientes: number
      total: number
      pedidoCompleto: boolean
    }
  | { ok: false; error: string }

export async function pickearRollo(
  pedidoId: string,
  textoEscaneado: string
): Promise<PickearRolloResult> {
  const supabase = await createClient()

  if (!textoEscaneado.trim()) {
    return { ok: false, error: 'Falta el número de pieza.' }
  }

  const numeroPieza = textoEscaneado.trim()

  const { data, error } = await supabase.rpc('pickear_rollo', {
    p_pedido_id: pedidoId,
    p_numero_pieza: numeroPieza,
  })

  if (error) return { ok: false, error: error.message }

  const json = data as {
    rollo_id: string
    numero_pieza: string
    kilos: number | null
    ubicacion: string | null
    articulo_id: string | null
    color_id: string | null
    pedido_partida_id: string
    partida_real_lote: string | null
    partida_solicitada_lote: string | null
    es_sustitucion_partida: boolean
    pendientes: number
    total: number
    pedido_completo: boolean
  }

  revalidatePath(`/picking/${pedidoId}`)
  revalidatePath('/picking')
  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/pedidos')

  return {
    ok: true,
    rolloId: json.rollo_id,
    numeroPieza: json.numero_pieza,
    kilos: json.kilos,
    ubicacion: json.ubicacion,
    articuloId: json.articulo_id,
    colorId: json.color_id,
    pedidoPartidaId: json.pedido_partida_id,
    partidaRealLote: json.partida_real_lote,
    partidaSolicitadaLote: json.partida_solicitada_lote,
    esSustitucionPartida: Boolean(json.es_sustitucion_partida),
    pendientes: json.pendientes,
    total: json.total,
    pedidoCompleto: json.pedido_completo,
  }
}

// ── Reemplazo de rollo por falla detectada en picking ───────

export type ReemplazoResult =
  | {
      ok: true
      pedidoRolloId: string
      rolloId: string
      numeroPieza: string
      kilos: number | null
      ubicacion: string | null
      articuloId: string | null
      colorId: string | null
      pedidoPartidaId: string
      partidaRealLote: string | null
      partidaSolicitadaLote: string | null
      esSustitucionPartida: boolean
    }
  | { ok: false; error: string }

export async function reemplazarRolloEnPicking(input: {
  pedidoId: string
  rolloViejoId: string
  numeroPiezaNuevo: string
  motivo: string
}): Promise<ReemplazoResult> {
  const supabase = await createClient()

  if (!input.numeroPiezaNuevo.trim()) {
    return { ok: false, error: 'Falta el numero de pieza nuevo.' }
  }

  const { data, error } = await supabase.rpc('reemplazar_rollo_picking', {
    p_pedido_id: input.pedidoId,
    p_rollo_viejo_id: input.rolloViejoId,
    p_numero_pieza_nuevo: input.numeroPiezaNuevo.trim(),
    p_motivo: input.motivo.trim() || null,
  })
  if (error) return { ok: false, error: error.message }

  return mapReemplazo(data, input.pedidoId)
}

// ── Quitar rollo ya pickeado ────────────────────────────────

export type QuitarRolloResult =
  | {
      ok: true
      pedidoRolloId: string
      rolloId: string
      numeroPieza: string
      pedidoPartidaId: string | null
      pendientes: number
      total: number
    }
  | { ok: false; error: string }

export async function quitarRolloDePicking(input: {
  pedidoId: string
  pedidoRolloId: string
  motivo?: string
}): Promise<QuitarRolloResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('quitar_rollo_picking', {
    p_pedido_id: input.pedidoId,
    p_pedido_rollo_id: input.pedidoRolloId,
    p_motivo: input.motivo?.trim() || null,
  })
  if (error) return { ok: false, error: error.message }

  const json = data as {
    pedido_rollo_id: string
    rollo_id: string
    numero_pieza: string
    pedido_partida_id: string | null
    pendientes: number
    total: number
  }

  revalidatePath(`/picking/${input.pedidoId}`)
  revalidatePath('/picking')
  revalidatePath(`/pedidos/${input.pedidoId}`)
  revalidatePath('/pedidos')

  return {
    ok: true,
    pedidoRolloId: json.pedido_rollo_id,
    rolloId: json.rollo_id,
    numeroPieza: json.numero_pieza,
    pedidoPartidaId: json.pedido_partida_id,
    pendientes: json.pendientes,
    total: json.total,
  }
}

function mapReemplazo(data: unknown, pedidoId: string): ReemplazoResult {
  const json = data as {
    pedido_rollo_id: string
    rollo_id: string
    numero_pieza: string
    kilos: number | null
    ubicacion: string | null
    articulo_id: string | null
    color_id: string | null
    pedido_partida_id: string
    partida_real_lote: string | null
    partida_solicitada_lote: string | null
    es_sustitucion_partida: boolean
  }

  revalidatePath(`/picking/${pedidoId}`)
  revalidatePath('/picking')
  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/pedidos')

  return {
    ok: true,
    pedidoRolloId: json.pedido_rollo_id,
    rolloId: json.rollo_id,
    numeroPieza: json.numero_pieza,
    kilos: json.kilos,
    ubicacion: json.ubicacion,
    articuloId: json.articulo_id,
    colorId: json.color_id,
    pedidoPartidaId: json.pedido_partida_id,
    partidaRealLote: json.partida_real_lote,
    partidaSolicitadaLote: json.partida_solicitada_lote,
    esSustitucionPartida: Boolean(json.es_sustitucion_partida),
  }
}
