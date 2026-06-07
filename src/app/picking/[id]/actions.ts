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
  | { ok: true; pendientes: number; total: number }
  | { ok: false; error: string }

export async function reemplazarRolloEnPicking(input: {
  pedidoId: string
  rolloViejoId: string
  rolloNuevoId: string
  motivoCategoria: string
  motivoTexto: string
}): Promise<ReemplazoResult> {
  const supabase = await createClient()

  if (!input.motivoCategoria) {
    return { ok: false, error: 'Falta el motivo del reemplazo.' }
  }

  const { data, error } = await supabase.rpc('reemplazar_rollo_en_pedido', {
    p_pedido_id: input.pedidoId,
    p_rollo_viejo_id: input.rolloViejoId,
    p_rollo_nuevo_id: input.rolloNuevoId,
    p_motivo_categoria: input.motivoCategoria,
    p_motivo_texto: input.motivoTexto.trim() || null,
  })

  if (error) return { ok: false, error: error.message }

  const json = data as { pendientes: number; total: number }

  revalidatePath(`/picking/${input.pedidoId}`)
  revalidatePath('/picking')

  return { ok: true, pendientes: json.pendientes, total: json.total }
}
