import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SetupForm from './SetupForm'

export default async function SetupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre')
    .eq('id', user.id)
    .single()

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-action font-heading text-lg font-bold text-action-foreground">
              N
            </div>
            <p className="font-heading text-2xl font-bold">NUDO</p>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-normal">
              Configura tu contraseña
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bienvenido{profile?.nombre ? `, ${profile.nombre}` : ''}. Definila
              para empezar a trabajar.
            </p>
          </div>
        </div>
        <SetupForm />
      </div>
    </main>
  )
}
