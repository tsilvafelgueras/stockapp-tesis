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
