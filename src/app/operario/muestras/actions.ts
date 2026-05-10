'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type RegistrarMuestraResult =
  | { ok: true; muestraId: string }
  | { ok: false; error: string }

export async function registrarMuestra(input: {
  rolloId: string
  kilos: number
  cliente: string
  motivo: string
  pedidoId: string | null
}): Promise<RegistrarMuestraResult> {
  const supabase = await createClient()

  if (!input.rolloId) return { ok: false, error: 'Falta seleccionar el rollo.' }
  if (!input.cliente.trim())
    return { ok: false, error: 'El cliente es obligatorio.' }
  if (!Number.isFinite(input.kilos) || input.kilos <= 0)
    return { ok: false, error: 'Los kilos deben ser un número mayor a cero.' }

  const { data, error } = await supabase.rpc('registrar_muestra', {
    p_rollo_id: input.rolloId,
    p_kilos: input.kilos,
    p_cliente: input.cliente.trim(),
    p_motivo: input.motivo,
    p_pedido_id: input.pedidoId,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/operario/muestras')
  revalidatePath('/stock')
  return { ok: true, muestraId: data as string }
}
