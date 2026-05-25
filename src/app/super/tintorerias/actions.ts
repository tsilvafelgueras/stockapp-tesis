'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type ReaderType = 'qr' | 'barcode' | null

async function requireSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'super' ? user : null
}

export async function actualizarPromptYReader(input: {
  tintoreriaId: string
  nombre?: string
  extractionPrompt: string | null
  readerType: ReaderType
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireSuperAdmin()
  if (!me) return { ok: false, error: 'No autorizado.' }

  if (input.readerType !== null && input.readerType !== 'qr' && input.readerType !== 'barcode') {
    return { ok: false, error: 'reader_type inválido.' }
  }

  const admin = createAdminClient()
  const update: Record<string, unknown> = {
    extraction_prompt: input.extractionPrompt?.trim() || null,
    reader_type: input.readerType,
  }
  if (typeof input.nombre === 'string') {
    const nombre = input.nombre.trim()
    if (!nombre) return { ok: false, error: 'El nombre no puede estar vacío.' }
    update.nombre = nombre
  }

  const { error } = await admin
    .from('tintorerias')
    .update(update)
    .eq('id', input.tintoreriaId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/super/tintorerias')
  revalidatePath(`/super/tintorerias/${input.tintoreriaId}`)
  return { ok: true }
}

export async function crearTintoreriaSuper(input: {
  nombre: string
  extractionPrompt: string | null
  readerType: ReaderType
}) {
  const me = await requireSuperAdmin()
  if (!me) return { error: 'No autorizado.' }

  const nombre = input.nombre.trim()
  if (!nombre) return { error: 'El nombre de la tintorería es obligatorio.' }
  if (input.readerType !== null && input.readerType !== 'qr' && input.readerType !== 'barcode') {
    return { error: 'reader_type inválido.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tintorerias')
    .insert({
      nombre,
      extraction_prompt: input.extractionPrompt?.trim() || null,
      reader_type: input.readerType,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: `No se pudo crear la tintorería: ${error?.message}` }
  }

  revalidatePath('/super/tintorerias')
  redirect(`/super/tintorerias/${data.id}`)
}

export async function asociarTintoreriaAEmpresa(input: {
  tintoreriaId: string
  empresaId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireSuperAdmin()
  if (!me) return { ok: false, error: 'No autorizado.' }

  if (!input.tintoreriaId || !input.empresaId) {
    return { ok: false, error: 'Faltan datos.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('empresa_tintorerias').insert({
    empresa_id: input.empresaId,
    tintoreria_id: input.tintoreriaId,
    activo: true,
  })

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'La empresa ya tiene esta tintorería asociada.' }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/super/tintorerias')
  revalidatePath(`/super/tintorerias/${input.tintoreriaId}`)
  return { ok: true }
}

export async function desasociarTintoreriaDeEmpresa(input: {
  tintoreriaId: string
  empresaId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireSuperAdmin()
  if (!me) return { ok: false, error: 'No autorizado.' }

  const admin = createAdminClient()

  const { count, error: countError } = await admin
    .from('ingresos')
    .select('id', { count: 'exact', head: true })
    .eq('tintoreria_id', input.tintoreriaId)
    .eq('empresa_id', input.empresaId)

  if (countError) return { ok: false, error: countError.message }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error:
        'No se puede desasociar: la empresa tiene ingresos cargados con esta tintorería.',
    }
  }

  const { error } = await admin
    .from('empresa_tintorerias')
    .delete()
    .eq('empresa_id', input.empresaId)
    .eq('tintoreria_id', input.tintoreriaId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/super/tintorerias')
  revalidatePath(`/super/tintorerias/${input.tintoreriaId}`)
  return { ok: true }
}
