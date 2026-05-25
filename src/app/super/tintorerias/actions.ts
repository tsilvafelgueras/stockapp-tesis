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
  extractionPrompt: string | null
  readerType: ReaderType
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireSuperAdmin()
  if (!me) return { ok: false, error: 'No autorizado.' }

  if (input.readerType !== null && input.readerType !== 'qr' && input.readerType !== 'barcode') {
    return { ok: false, error: 'reader_type inválido.' }
  }

  const admin = createAdminClient()
  const promptValue = input.extractionPrompt?.trim() || null
  const { error } = await admin
    .from('tintorerias')
    .update({
      extraction_prompt: promptValue,
      reader_type: input.readerType,
    })
    .eq('id', input.tintoreriaId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/super/tintorerias')
  revalidatePath(`/super/tintorerias/${input.tintoreriaId}`)
  return { ok: true }
}

export async function crearTintoreriaSuper(input: {
  empresa_id: string
  nombre: string
  extractionPrompt: string | null
  readerType: ReaderType
  contacto?: string
  email?: string
  telefono?: string
}) {
  const me = await requireSuperAdmin()
  if (!me) return { error: 'No autorizado.' }

  const nombre = input.nombre.trim()
  if (!nombre) return { error: 'El nombre de la tintorería es obligatorio.' }
  if (!input.empresa_id) return { error: 'Hay que elegir empresa.' }
  if (input.readerType !== null && input.readerType !== 'qr' && input.readerType !== 'barcode') {
    return { error: 'reader_type inválido.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tintorerias')
    .insert({
      empresa_id: input.empresa_id,
      nombre,
      extraction_prompt: input.extractionPrompt?.trim() || null,
      reader_type: input.readerType,
      contacto: input.contacto?.trim() || null,
      email: input.email?.trim() || null,
      telefono: input.telefono?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: `No se pudo crear la tintorería: ${error?.message}` }
  }

  revalidatePath('/super/tintorerias')
  redirect(`/super/tintorerias/${data.id}`)
}
