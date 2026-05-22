'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type SimpleResult = { ok: true } | { ok: false; error: string }

export async function crearPedidoPendiente(data: {
  cliente: string
  articulo_id: string
  color: string
  metros_estimados: string
  kilos_estimados: string
  notas: string
}): Promise<SimpleResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión expirada — volvé a entrar.' }

  if (!data.cliente.trim()) {
    return { ok: false, error: 'El nombre del cliente es obligatorio.' }
  }

  const { error } = await supabase.from('pedidos_pendientes').insert({
    cliente: data.cliente.trim(),
    articulo_id: data.articulo_id || null,
    color: data.color.trim() || null,
    metros_estimados: data.metros_estimados ? parseFloat(data.metros_estimados) : null,
    kilos_estimados: data.kilos_estimados ? parseFloat(data.kilos_estimados) : null,
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

export async function cancelarPedidoPendiente(id: string): Promise<SimpleResult> {
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
