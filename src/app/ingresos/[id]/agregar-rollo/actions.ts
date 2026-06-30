'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validarUbicacionActiva } from '@/lib/ubicacionesServer'

export type AgregarRolloInput = {
  numero_pieza: string
  articulo_id: string | null
  color_id: string | null
  kilos: number | null
  metros: number | null
  ubicacion: string | null
}

export type AgregarRolloResult =
  | { ok: true }
  | { ok: false; error: string }

export async function agregarRolloAIngreso(
  ingresoId: string,
  datos: AgregarRolloInput
): Promise<AgregarRolloResult> {
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

  if (profile?.role !== 'operario' && profile?.role !== 'admin') {
    return { ok: false, error: 'No tenés permiso para agregar rollos.' }
  }

  const numeroPieza = datos.numero_pieza.trim()
  if (!numeroPieza) return { ok: false, error: 'El número de pieza es obligatorio.' }

  if (datos.kilos == null || !Number.isFinite(datos.kilos) || datos.kilos <= 0) {
    return { ok: false, error: 'Los kilos son obligatorios y deben ser mayores a cero.' }
  }

  // RLS garantiza que solo vemos ingresos de nuestra empresa.
  const { data: ingreso } = await supabase
    .from('ingresos')
    .select('id, estado')
    .eq('id', ingresoId)
    .single()

  if (!ingreso) return { ok: false, error: 'No se encontró el ingreso.' }

  // Verificar unicidad del número de pieza dentro de la empresa (RLS scope).
  const { data: existente } = await supabase
    .from('rollos')
    .select('id')
    .eq('numero_pieza', numeroPieza)
    .maybeSingle()

  if (existente) {
    return {
      ok: false,
      error: `Ya existe un rollo con número "${numeroPieza}" en el sistema.`,
    }
  }

  if (datos.ubicacion) {
    const valida = await validarUbicacionActiva(supabase, datos.ubicacion)
    if (!valida.ok) return { ok: false, error: valida.error }
  }

  // Rollos de ingresos en borrador quedan pendientes hasta confirmar.
  const estadoRollo = ingreso.estado === 'borrador' ? 'pendiente' : 'en_stock'

  const { error: insertError } = await supabase.from('rollos').insert({
    ingreso_id: ingresoId,
    numero_pieza: numeroPieza,
    articulo_id: datos.articulo_id || null,
    color_id: datos.color_id || null,
    kilos: datos.kilos ?? null,
    metros: datos.metros ?? null,
    ubicacion: datos.ubicacion || null,
    estado: estadoRollo,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return {
        ok: false,
        error: `Ya existe un rollo con número "${numeroPieza}" en el sistema.`,
      }
    }
    return { ok: false, error: insertError.message }
  }

  // Si se agregó como en_stock y el ingreso no está ya confirmado,
  // verificar si quedan pendientes para cerrar el ingreso automáticamente.
  if (estadoRollo === 'en_stock' && ingreso.estado !== 'confirmado') {
    const { count } = await supabase
      .from('rollos')
      .select('id', { count: 'exact', head: true })
      .eq('ingreso_id', ingresoId)
      .eq('estado', 'pendiente')

    if (count === 0) {
      await supabase
        .from('ingresos')
        .update({ estado: 'confirmado' })
        .eq('id', ingresoId)
    }
  }

  revalidatePath(`/ingresos/${ingresoId}`)
  revalidatePath('/ingresos')
  revalidatePath('/stock')

  return { ok: true }
}
