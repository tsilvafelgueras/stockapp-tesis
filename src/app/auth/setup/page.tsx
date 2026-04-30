import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SetupForm from './SetupForm'

export default async function SetupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Sin sesión → al login
  if (!user) redirect('/login')

  // Si el usuario ya tiene contraseña fijada (no recién invitado),
  // mandarlo al home, que el middleware lo redirija al dashboard.
  // Heurística: en una invitación recién aceptada el campo `last_sign_in_at`
  // es null o muy reciente. Para simplicidad, mostrar siempre el form.
  // El usuario puede igualmente cambiar su contraseña desde acá.

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre')
    .eq('id', user.id)
    .single()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm space-y-6 rounded-xl bg-white p-8 shadow-sm border">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">StockApp</h1>
          <p className="text-sm text-muted-foreground">
            Bienvenido{profile?.nombre ? `, ${profile.nombre}` : ''}. Definí tu
            contraseña para empezar.
          </p>
        </div>
        <SetupForm />
      </div>
    </main>
  )
}
