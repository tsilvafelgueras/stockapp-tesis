'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { extraerCodigoRollo } from '@/lib/scanner'

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

  const { data: rows, error: expectedError } = await supabase
    .from('pedido_rollos')
    .select('rollos ( numero_pieza )')
    .eq('pedido_id', pedidoId)

  if (expectedError) return { ok: false, error: expectedError.message }

  type ExpectedRow = {
    rollos: { numero_pieza: string } | null
  }
  const codigosEsperados = ((rows ?? []) as unknown as ExpectedRow[])
    .map((row) => row.rollos?.numero_pieza)
    .filter((value): value is string => Boolean(value))

  const numeroPieza = extraerCodigoRollo(textoEscaneado, codigosEsperados)
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
