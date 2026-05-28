'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type CrearPedidoResult =
  | { ok: true; pedidoId: string }
  | { ok: false; error: string }

export async function crearPedido(
  clienteId: string,
  numeroRemitoExterno: string,
  rolloIds: string[],
  fechaEntregaComprometida: string
): Promise<CrearPedidoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Tu sesión expiró. Volvé a entrar.' }

  if (!clienteId) {
    return { ok: false, error: 'Elegí un cliente del catálogo.' }
  }
  if (rolloIds.length === 0) {
    return { ok: false, error: 'Tenés que seleccionar al menos un rollo.' }
  }

  // La RPC valida rol, empresa, estado de los rollos y atomicidad.
  const { data, error } = await supabase.rpc('crear_pedido', {
    p_cliente_id: clienteId,
    p_numero_remito_externo: numeroRemitoExterno.trim() || null,
    p_rollo_ids: rolloIds,
    p_fecha_entrega_comprometida: fechaEntregaComprometida || null,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/pedidos')
  revalidatePath('/stock')
  return { ok: true, pedidoId: data as string }
}

export type SimpleResult = { ok: true } | { ok: false; error: string }

export async function cancelarPedido(
  pedidoId: string,
  motivoCaida = '',
  comentario = '',
  ubicacionReasignacion = 'A ordenar'
): Promise<SimpleResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancelar_pedido', {
    p_pedido_id: pedidoId,
    p_motivo_caida: motivoCaida || null,
    p_comentario: comentario || null,
    p_ubicacion_reasignacion: ubicacionReasignacion || 'A ordenar',
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/stock')
  return { ok: true }
}

export async function confirmarEgresoPedido(
  pedidoId: string,
  comentario = '',
  numeroRemitoSalida = ''
): Promise<SimpleResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('confirmar_egreso_pedido', {
    p_pedido_id: pedidoId,
    p_comentario: comentario || null,
    p_numero_remito_salida: numeroRemitoSalida || null,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${pedidoId}`)
  return { ok: true }
}

export async function entregarPedido(
  pedidoId: string
): Promise<SimpleResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('entregar_pedido', {
    p_pedido_id: pedidoId,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${pedidoId}`)
  revalidatePath('/stock')
  return { ok: true }
}
