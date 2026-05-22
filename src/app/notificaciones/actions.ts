'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type Result = { ok: true } | { ok: false; error: string }

export async function marcarLeida(id: string): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida_at: new Date().toISOString() })
    .eq('id', id)
    .is('leida_at', null)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function marcarTodasLeidas(): Promise<Result> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida_at: new Date().toISOString() })
    .is('leida_at', null)
    .is('resuelta_at', null)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/', 'layout')
  return { ok: true }
}
