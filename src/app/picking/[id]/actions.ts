'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PickearRolloResult =
  | {
      ok: true
      numeroPieza: string
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
  if (!numeroPieza) {
    return { ok: false, error: 'No se pudo leer un número de pieza válido.' }
  }

  const { data, error } = await supabase.rpc('pickear_rollo', {
    p_pedido_id: pedidoId,
    p_numero_pieza: numeroPieza,
  })

  if (error) return { ok: false, error: error.message }

  const json = data as {
    rollo_id: string
    numero_pieza: string
    pendientes: number
    total: number
    pedido_completo: boolean
  }

  revalidatePath(`/picking/${pedidoId}`)
  revalidatePath('/picking')

  return {
    ok: true,
    numeroPieza: json.numero_pieza,
    pendientes: json.pendientes,
    total: json.total,
    pedidoCompleto: json.pedido_completo,
  }
}
