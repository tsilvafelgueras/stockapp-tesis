import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { homePathForRole } from '@/lib/auth/home-path'

export default async function PickingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nombre, empresas(nombre)')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'operario') {
    redirect(`${homePathForRole(profile?.role)}?denegado=picking`)
  }

  const empresaNombre =
    (profile.empresas as unknown as { nombre: string } | null)?.nombre ?? null

  return (
    <AppShell
      role={profile.role}
      userName={profile.nombre}
      empresaNombre={empresaNombre}
    >
      {children}
    </AppShell>
  )
}
