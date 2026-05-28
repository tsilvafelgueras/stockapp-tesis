'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type SimpleResult = { ok: true } | { ok: false; error: string }

export async function crearPedidoPendiente(data: {
  cliente_id: string
  articulo_id: string
  color_id: string
  tipo_demanda: string
  prioridad: string
  fecha_requerida: string
  metros_estimados: string
  kilos_estimados: string
  notas: string
}): Promise<SimpleResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesion expirada. Volve a entrar.' }

  if (!data.cliente_id) {
    return { ok: false, error: 'Elegi un cliente del catalogo.' }
  }
  if (!data.articulo_id) {
    return { ok: false, error: 'Elegi un articulo del catalogo.' }
  }
  if (!data.color_id) {
    return { ok: false, error: 'Elegi un color del catalogo.' }
  }

  const tipoDemanda = normalizarTipoDemanda(data.tipo_demanda)
  const prioridad = normalizarPrioridad(data.prioridad)
  if (prioridad === 'programada' && !data.fecha_requerida) {
    return {
      ok: false,
      error: 'La prioridad programada necesita fecha requerida.',
    }
  }

  const [{ data: cliente }, { data: color }] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nombre')
      .eq('id', data.cliente_id)
      .eq('activo', true)
      .single(),
    supabase
      .from('colores')
      .select('id, nombre')
      .eq('id', data.color_id)
      .eq('activo', true)
      .single(),
  ])

  if (!cliente) {
    return { ok: false, error: 'Cliente no encontrado o inactivo.' }
  }
  if (!color) {
    return { ok: false, error: 'Color no encontrado o inactivo.' }
  }

  const { error } = await supabase.from('pedidos_pendientes').insert({
    cliente: cliente.nombre,
    cliente_id: data.cliente_id,
    articulo_id: data.articulo_id,
    color: color.nombre,
    color_id: data.color_id,
    tipo_demanda: tipoDemanda,
    prioridad,
    fecha_requerida: data.fecha_requerida || null,
    metros_estimados: data.metros_estimados
      ? parseFloat(data.metros_estimados)
      : null,
    kilos_estimados: data.kilos_estimados
      ? parseFloat(data.kilos_estimados)
      : null,
    notas: data.notas.trim() || null,
    created_by: user.id,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/pedidos-pendientes')
  revalidatePath('/ventas/dashboard')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}

export async function resolverPedidoPendiente(id: string): Promise<SimpleResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos_pendientes')
    .update({ estado: 'resuelto', resolved_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/pedidos-pendientes')
  revalidatePath('/ventas/dashboard')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}

export async function cancelarPedidoPendiente(
  id: string
): Promise<SimpleResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos_pendientes')
    .update({ estado: 'cancelado' })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/pedidos-pendientes')
  revalidatePath('/ventas/dashboard')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}

function normalizarTipoDemanda(value: string): string {
  return value === 'pedido_a_producir'
    ? 'pedido_a_producir'
    : 'demanda_sin_stock'
}

function normalizarPrioridad(value: string): string {
  if (
    value === 'critica' ||
    value === 'alta' ||
    value === 'programada' ||
    value === 'flexible'
  ) {
    return value
  }
  return 'flexible'
}
