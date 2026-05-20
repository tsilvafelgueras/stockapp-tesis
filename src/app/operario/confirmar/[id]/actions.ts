'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { extraerCodigoRollo } from '@/lib/scanner'

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

  const numeroPieza = extraerCodigoRollo(
    textoEscaneado,
    rollos.map((r) => r.numero_pieza)
  )
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

  revalidatePath(`/operario/confirmar/${ingresoId}`)
  revalidatePath('/operario/confirmar')

  return {
    ok: true,
    rollo: { id: rollo.id, numero_pieza: rollo.numero_pieza },
    ingresoCompleto,
  }
}
