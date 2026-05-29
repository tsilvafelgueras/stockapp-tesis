import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'

export default async function StockLayout({
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
    .select('role, nombre, empresa_id_actuando, empresas(nombre)')
    .eq('id', user.id)
    .single()

  // Stock es para roles tenant (operario, ventas, admin) y para
  // super-admin con empresa_id_actuando (impersonación).
  const isSuperActuando =
    profile?.role === 'super' && !!profile?.empresa_id_actuando
  if (
    profile?.role !== 'operario' &&
    profile?.role !== 'ventas' &&
    profile?.role !== 'admin' &&
    !isSuperActuando
  ) {
    redirect('/')
  }

  let empresaNombre: string | null = null
  if (isSuperActuando) {
    const { data: empresa } = await supabase
      .from('empresas')
      .select('nombre')
      .eq('id', profile!.empresa_id_actuando!)
      .single()
    empresaNombre = empresa?.nombre ?? null
  } else {
    empresaNombre =
      (profile!.empresas as unknown as { nombre: string } | null)?.nombre ?? null
  }

  return (
    <AppShell
      role={profile!.role as 'operario' | 'ventas' | 'admin' | 'super'}
      userName={profile!.nombre}
      empresaNombre={empresaNombre}
      actuandoComoSuper={isSuperActuando}
    >
      {children}
    </AppShell>
  )
}
