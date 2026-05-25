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

  if (profile?.role !== 'admin') redirect(`/ingresos/${id}`)

  const [
    { data: ingreso },
    { data: empresaTints },
    { data: articulos },
    { data: colores },
    { data: rollos },
  ] = await Promise.all([
    supabase
      .from('ingresos')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('empresa_tintorerias')
      .select('tintorerias ( id, nombre )')
      .eq('activo', true),
    supabase.from('articulos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('colores').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('rollos').select('kilos').eq('ingreso_id', id),
  ])

  if (!ingreso) notFound()

  type EmpresaTintRow = { tintorerias: { id: string; nombre: string } | null }
  const tintorerias = ((empresaTints ?? []) as unknown as EmpresaTintRow[])
    .map((r) => r.tintorerias)
    .filter((t): t is { id: string; nombre: string } => t != null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const cantidadRollos = rollos?.length ?? 0
  const sumaKilos =
    rollos?.reduce((acc, r) => acc + (Number(r.kilos) || 0), 0) ?? 0

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <BackButton href={`/ingresos/${id}`} label="Volver al ingreso" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Editar ingreso</h1>
        <p className="text-sm text-muted-foreground">
          Modificá los datos del encabezado. Los rollos no se editan aquí.
        </p>
      </div>

      <EditarIngresoForm
        ingreso={ingreso}
        tintorerias={tintorerias}
        articulos={articulos ?? []}
        colores={colores ?? []}
        cantidadRollosReal={cantidadRollos}
        sumaKilosReal={sumaKilos}
      />
    </div>
  )
}
