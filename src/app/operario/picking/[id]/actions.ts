'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
  numeroPieza: string
): Promise<PickearRolloResult> {
  const supabase = await createClient()

  if (!numeroPieza.trim()) {
    return { ok: false, error: 'Falta el número de pieza.' }
  }

  const { data, error } = await supabase.rpc('pickear_rollo', {
    p_pedido_id: pedidoId,
    p_numero_pieza: numeroPieza.trim(),
  })

  if (error) return { ok: false, error: error.message }

  const json = data as {
    rollo_id: string
    numero_pieza: string
    pendientes: number
    total: number
    pedido_completo: boolean
  }

  revalidatePath(`/operario/picking/${pedidoId}`)
  revalidatePath('/operario/picking')

  return {
    ok: true,
    numeroPieza: json.numero_pieza,
    pendientes: json.pendientes,
    total: json.total,
    pedidoCompleto: json.pedido_completo,
  }
}
