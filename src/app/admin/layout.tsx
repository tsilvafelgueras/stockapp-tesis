import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'

export default async function AdminLayout({
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
    .select('role, nombre, empresa_id, empresas(nombre)')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  const empresaNombre =
    (profile.empresas as unknown as { nombre: string } | null)?.nombre ?? null

  return (
    <AppShell
      role="admin"
      userName={profile.nombre}
      empresaNombre={empresaNombre}
    >
      {children}
    </AppShell>
  )
}
