import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

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

  const empresaNombre = (
    profile.empresas as unknown as { nombre: string } | null
  )?.nombre

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-sm">
          StockApp{empresaNombre ? ` · ${empresaNombre}` : ''}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{profile.nombre}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 bg-zinc-50">{children}</main>
    </div>
  )
}
