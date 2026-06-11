import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Landing from '@/components/landing/Landing'

export const metadata = {
  title: 'NUDO · Tu depósito bajo control total',
  description:
    'NUDO es el software de gestión de rollos para PyMEs textiles. Trazá cada pieza desde la tintorería hasta el despacho, con escaneo en mano y reportes en tiempo real.',
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
