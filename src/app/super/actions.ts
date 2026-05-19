'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getSiteUrl(): Promise<string> {
  const headerList = await headers()
  const host = headerList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}

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

export async function setEmpresaActivo(
  empresaId: string,
  activo: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireSuperAdmin()
  if (!me) return { ok: false, error: 'No autorizado.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('empresas')
    .update({ activo })
    .eq('id', empresaId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/super')
  return { ok: true }
}

export async function createEmpresaConAdmin(input: {
  empresa_nombre: string
  admin_nombre: string
  admin_email: string
}) {
  const me = await requireSuperAdmin()
  if (!me) return { error: 'No autorizado.' }

  const empresa_nombre = input.empresa_nombre.trim()
  const admin_nombre = input.admin_nombre.trim()
  const admin_email = input.admin_email.trim()

  if (!empresa_nombre) return { error: 'El nombre de la empresa es obligatorio.' }
  if (!admin_nombre) return { error: 'El nombre del admin es obligatorio.' }
  if (!admin_email) return { error: 'El email del admin es obligatorio.' }

  const admin = createAdminClient()

  const { data: empresa, error: eError } = await admin
    .from('empresas')
    .insert({ nombre: empresa_nombre })
    .select()
    .single()

  if (eError || !empresa) {
    if (eError?.code === '23505') {
      return {
        error: `Ya existe una empresa con el nombre "${empresa_nombre}". Elegí otro nombre.`,
      }
    }
    return { error: `Error creando empresa: ${eError?.message}` }
  }

  const siteUrl = await getSiteUrl()
  const { error: iError } = await admin.auth.admin.inviteUserByEmail(
    admin_email,
    {
      data: {
        nombre: admin_nombre,
        role: 'admin',
        empresa_id: empresa.id,
      },
      redirectTo: `${siteUrl}/auth/confirm?next=/auth/setup`,
    }
  )

  if (iError) {
    // Rollback: borrar empresa si la invitación falló
    await admin.from('empresas').delete().eq('id', empresa.id)
    return { error: `Error invitando admin: ${iError.message}` }
  }

  revalidatePath('/super')
  return { success: true }
}
