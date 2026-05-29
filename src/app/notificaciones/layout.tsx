import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'

export default async function NotificacionesLayout({
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

  if (profile?.role !== 'admin' && profile?.role !== 'ventas') {
    redirect('/')
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
