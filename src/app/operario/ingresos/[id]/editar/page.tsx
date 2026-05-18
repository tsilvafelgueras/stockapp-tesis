import { createClient } from '@/lib/supabase/server'
import BackButton from '@/components/BackButton'
import { notFound, redirect } from 'next/navigation'
import EditarIngresoForm from './EditarIngresoForm'

export default async function EditarIngresoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'admin') redirect(`/operario/ingresos/${id}`)

  const [{ data: ingreso }, { data: tintorerias }, { data: articulos }] =
    await Promise.all([
      supabase
        .from('ingresos')
        .select('*')
        .eq('id', id)
        .single(),
      supabase.from('tintorerias').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('articulos').select('id, nombre').eq('activo', true).order('nombre'),
    ])

  if (!ingreso) notFound()

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <BackButton href={`/operario/ingresos/${id}`} label="Volver al ingreso" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Editar ingreso</h1>
        <p className="text-sm text-muted-foreground">
          Modificá los datos del encabezado. Los rollos no se editan aquí.
        </p>
      </div>

      <EditarIngresoForm
        ingreso={ingreso}
        tintorerias={tintorerias ?? []}
        articulos={articulos ?? []}
      />
    </div>
  )
}
