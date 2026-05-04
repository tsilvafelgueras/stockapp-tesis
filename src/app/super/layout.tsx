import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'

export default async function SuperLayout({
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
    .select('nombre, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super') redirect('/')

  return (
    <AppShell role="super" userName={profile.nombre} empresaNombre={null}>
      {children}
    </AppShell>
  )
}
