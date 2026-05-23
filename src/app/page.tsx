import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Landing from '@/components/landing/Landing'

export const metadata = {
  title: 'NUDO · Gestión de stock textil para PyMEs',
  description:
    'Cargá planillas con IA, confirmá rollos con scanner QR, armá pedidos sin equivocarte. NUDO es el software de depósito pensado para fábricas textiles argentinas.',
}

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'super') redirect('/super')
    if (profile?.role === 'operario') redirect('/operario/dashboard')
    if (profile?.role === 'ventas') redirect('/ventas/dashboard')
    redirect('/admin/dashboard')
  }

  return <Landing />
}
