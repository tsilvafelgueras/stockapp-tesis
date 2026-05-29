'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
  if (!admin_nombre) return { error: 'El nombre del administrador es obligatorio.' }
  if (!admin_email) return { error: 'El email del administrador es obligatorio.' }

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

  // La empresa nueva tiene que aparecer también en el dropdown de
  // "Asociar empresa" de /super/tintorerias/[id]. Esa página cachea
  // la lista de empresas — sin invalidarla, la empresa recién creada
  // no aparece hasta hacer hard refresh.
  revalidatePath('/super')
  revalidatePath('/super/tintorerias')
  revalidatePath('/super/tintorerias/[id]', 'page')
  return { success: true }
}


// ── Invitar otro super-admin ───────────────────────────────────
//
// Crea la invitación con role='super' en raw_user_meta_data, que
// es lo que el trigger handle_new_user necesita para crear el
// profile con empresa_id=NULL sin violar el CHECK constraint.
// El dashboard de Supabase no permite pasar metadata en el
// "Invite user" del UI, por eso esta acción.

export async function inviteSuperAdmin(input: {
  nombre: string
  email: string
}) {
  const me = await requireSuperAdmin()
  if (!me) return { error: 'No autorizado.' }

  const nombre = input.nombre.trim()
  const email = input.email.trim()

  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (!email) return { error: 'El email es obligatorio.' }

  const admin = createAdminClient()
  const siteUrl = await getSiteUrl()

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      nombre,
      role: 'super',
    },
    redirectTo: `${siteUrl}/auth/confirm?next=/auth/setup`,
  })

  if (error) {
    return { error: `Error invitando super-admin: ${error.message}` }
  }

  revalidatePath('/super')
  return { success: true }
}


// ── Impersonación: super opera dentro de una empresa cliente ──
//
// El super-admin setea `empresa_id_actuando` en su propio perfil.
// Mientras está seteada, `current_empresa_id()` devuelve esa
// empresa, y las RLS + RPCs lo tratan como admin de ella.
// Importante: profiles.role SIGUE siendo 'super' — nunca cambia.

export async function iniciarImpersonacion(empresaId: string) {
  const me = await requireSuperAdmin()
  if (!me) return { error: 'No autorizado.' }
  if (!empresaId) return { error: 'Falta el id de la empresa.' }

  const admin = createAdminClient()

  // Validar que la empresa existe y está activa.
  const { data: empresa, error: eError } = await admin
    .from('empresas')
    .select('id, activo')
    .eq('id', empresaId)
    .single()

  if (eError || !empresa) {
    return { error: 'Empresa no encontrada.' }
  }
  if (!empresa.activo) {
    return {
      error:
        'La empresa está pausada. Reactivala antes de operar dentro de ella.',
    }
  }

  const { error: uError } = await admin
    .from('profiles')
    .update({ empresa_id_actuando: empresaId })
    .eq('id', me.id)

  if (uError) return { error: uError.message }

  // El profile cambió → todos los layouts deben reevaluar.
  revalidatePath('/', 'layout')
  redirect('/admin/dashboard')
}

export async function terminarImpersonacion() {
  const me = await requireSuperAdmin()
  if (!me) return { error: 'No autorizado.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ empresa_id_actuando: null })
    .eq('id', me.id)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/super')
}
