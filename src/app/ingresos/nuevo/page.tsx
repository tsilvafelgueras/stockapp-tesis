import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import NuevoIngresoForm from './NuevoIngresoForm'

export default async function NuevoIngresoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: empresaTints },
    { data: articulos },
    { data: colores },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('empresa_tintorerias')
      .select('tintoreria_id, tintorerias ( id, nombre )')
      .eq('activo', true),
    supabase
      .from('articulos')
      .select('id, nombre, color')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('colores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single(),
  ])

  type EmpresaTintRow = {
    tintoreria_id: string
    tintorerias: { id: string; nombre: string } | null
  }
  const tintorerias = (empresaTints ?? ([] as unknown as EmpresaTintRow[]))
    .map((r) => (r as unknown as EmpresaTintRow).tintorerias)
    .filter((t): t is { id: string; nombre: string } => t != null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const role = (profile?.role ?? 'operario') as 'operario' | 'admin'

  const sinCatalogos = !tintorerias.length || !articulos?.length

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <BackButton href="/ingresos" label="Volver a ingresos" />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">Nuevo ingreso</h1>
        <p className="text-sm text-muted-foreground">
          Carga manual o automática (con IA) de la planilla de tintorería
        </p>
      </div>

      {sinCatalogos ? (
        <div className="rounded-lg border bg-warning/10 border-warning/30 p-5">
          <p className="text-sm font-medium text-foreground">
            Antes de crear un ingreso necesitás tener al menos un artículo y
            una tintorería cargados.
          </p>
          <div className="flex gap-3 mt-3 text-sm">
            {!articulos?.length && (
              <Link
                href="/admin/articulos"
                className="underline hover:no-underline"
              >
                Crear artículo
              </Link>
            )}
            {!tintorerias.length && (
              <Link
                href="/admin/tintorerias"
                className="underline hover:no-underline"
              >
                Asociar tintorería
              </Link>
            )}
          </div>
        </div>
      ) : (
        <NuevoIngresoForm
          tintorerias={tintorerias}
          articulos={articulos!}
          colores={colores ?? []}
          role={role}
        />
      )}
    </div>
  )
}
