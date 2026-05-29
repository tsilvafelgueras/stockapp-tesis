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
    .select('role, nombre, empresa_id, empresa_id_actuando, empresas(nombre)')
    .eq('id', user.id)
    .single()

  const isSuperActuando =
    profile?.role === 'super' && !!profile?.empresa_id_actuando
  if (profile?.role !== 'admin' && !isSuperActuando) redirect('/')

  // Para super actuando, el nombre de empresa viene de la cliente
  // en la que está operando (no de sus propias empresas — el super
  // no tiene empresa_id). Para admin normal, viene de su propia
  // empresa (join ya hecho arriba).
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
      role={profile!.role as 'admin' | 'super'}
      userName={profile!.nombre}
      empresaNombre={empresaNombre}
      actuandoComoSuper={isSuperActuando}
    >
      {children}
    </AppShell>
  )
}
