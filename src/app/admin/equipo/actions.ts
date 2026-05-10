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

export async function inviteTeamMember(input: {
  nombre: string
  email: string
  role: 'operario' | 'ventas' | 'admin'
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión.' }

  const { data: meProfile } = await supabase
    .from('profiles')
    .select('empresa_id, role')
    .eq('id', user.id)
    .single()

  if (!meProfile || meProfile.role !== 'admin') {
    return { error: 'Solo el admin de la empresa puede invitar usuarios.' }
  }

  const nombre = input.nombre.trim()
  const email = input.email.trim()

  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (!email) return { error: 'El email es obligatorio.' }
  if (!['operario', 'ventas', 'admin'].includes(input.role)) {
    return { error: 'Rol inválido.' }
  }

  const admin = createAdminClient()
  const siteUrl = await getSiteUrl()

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      nombre,
      role: input.role,
      empresa_id: meProfile.empresa_id,
    },
    redirectTo: `${siteUrl}/auth/confirm?next=/auth/setup`,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/equipo')
  return { success: true }
}

export type SimpleResult = { ok: true } | { ok: false; error: string }

async function requireAdminEnEmpresa(): Promise<
  | { ok: true; user_id: string; empresa_id: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sin sesión.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, empresa_id')
    .eq('id', user.id)
    .single()

  if (
    !profile ||
    profile.role !== 'admin' ||
    !profile.empresa_id
  ) {
    return {
      ok: false,
      error: 'Solo el admin de la empresa puede gestionar el equipo.',
    }
  }
  return { ok: true, user_id: user.id, empresa_id: profile.empresa_id }
}

export async function updateUserRole(
  userId: string,
  nuevoRol: 'operario' | 'ventas' | 'admin'
): Promise<SimpleResult> {
  const ctx = await requireAdminEnEmpresa()
  if (!ctx.ok) return ctx

  if (!['operario', 'ventas', 'admin'].includes(nuevoRol)) {
    return { ok: false, error: 'Rol inválido.' }
  }

  if (userId === ctx.user_id) {
    return { ok: false, error: 'No te podés cambiar el rol a vos mismo.' }
  }

  const admin = createAdminClient()

  // Validar que el usuario sea de la misma empresa
  const { data: target } = await admin
    .from('profiles')
    .select('role, empresa_id')
    .eq('id', userId)
    .single()

  if (!target || target.empresa_id !== ctx.empresa_id) {
    return { ok: false, error: 'Usuario no encontrado.' }
  }

  // Si está bajando un admin, validar que quede al menos otro admin
  if (target.role === 'admin' && nuevoRol !== 'admin') {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', ctx.empresa_id)
      .eq('role', 'admin')
    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        error:
          'No podés dejar la empresa sin ningún admin. Promové primero a otro usuario.',
      }
    }
  }

  const { error } = await admin
    .from('profiles')
    .update({ role: nuevoRol })
    .eq('id', userId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/equipo')
  return { ok: true }
}

export async function deleteUser(userId: string): Promise<SimpleResult> {
  const ctx = await requireAdminEnEmpresa()
  if (!ctx.ok) return ctx

  if (userId === ctx.user_id) {
    return { ok: false, error: 'No te podés eliminar a vos mismo.' }
  }

  const admin = createAdminClient()

  const { data: target } = await admin
    .from('profiles')
    .select('role, empresa_id')
    .eq('id', userId)
    .single()

  if (!target || target.empresa_id !== ctx.empresa_id) {
    return { ok: false, error: 'Usuario no encontrado.' }
  }

  // No dejar la empresa sin ningún admin
  if (target.role === 'admin') {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', ctx.empresa_id)
      .eq('role', 'admin')
    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        error:
          'No podés eliminar al último admin. Promové primero a otro usuario.',
      }
    }
  }

  // Borrar usuario (cascadea en profiles por FK)
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/equipo')
  return { ok: true }
}
