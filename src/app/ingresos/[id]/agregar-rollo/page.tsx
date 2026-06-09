import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import BackButton from '@/components/BackButton'
import { getUbicacionesActivas } from '@/lib/ubicacionesServer'
import AgregarRolloForm from './AgregarRolloForm'
import type { PatronCodigo } from '@/lib/scanner'

export default async function AgregarRolloPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'operario' && profile?.role !== 'admin') {
    return notFound()
  }

  const { data: ingreso } = await supabase
    .from('ingresos')
    .select('id, estado, numero_lote, fecha_despacho, tintoreria_id, tintorerias ( nombre )')
    .eq('id', id)
    .single()

  if (!ingreso) notFound()

  const [
    { data: articulosRaw },
    { data: coloresRaw },
    ubicaciones,
    { data: rollosRaw },
    { data: patronesRaw },
  ] = await Promise.all([
    supabase.from('articulos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('colores').select('id, nombre').eq('activo', true).order('nombre'),
    getUbicacionesActivas(supabase),
    supabase
      .from('rollos')
      .select('articulo_id, color_id')
      .eq('ingreso_id', id)
      .not('articulo_id', 'is', null)
      .limit(1),
    ingreso.tintoreria_id
      ? supabase
          .from('tintoreria_codigo_patrones')
          .select('pattern, capture_group, prioridad')
          .eq('tintoreria_id', ingreso.tintoreria_id)
          .eq('activo', true)
          .order('prioridad')
      : Promise.resolve({ data: [] as PatronCodigo[], error: null }),
  ])

  const firstRollo = rollosRaw?.[0] ?? null

  const tintoreria = (
    ingreso.tintorerias as unknown as { nombre: string } | null
  )?.nombre

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <BackButton href={`/ingresos/${id}`} label="Volver al ingreso" />
        <h1 className="text-xl font-bold mt-2">Agregar rollo faltante</h1>
        <p className="text-sm text-muted-foreground">
          {ingreso.numero_lote
            ? `Partida ${ingreso.numero_lote}`
            : `Ingreso del ${ingreso.fecha_despacho}`}
          {tintoreria ? ` · ${tintoreria}` : ''}
        </p>
      </div>

      <AgregarRolloForm
        ingresoId={id}
        articulos={(articulosRaw ?? []) as { id: string; nombre: string }[]}
        colores={(coloresRaw ?? []) as { id: string; nombre: string }[]}
        ubicaciones={ubicaciones}
        patrones={(patronesRaw ?? []) as PatronCodigo[]}
        defaultArticuloId={(firstRollo?.articulo_id as string | null) ?? null}
        defaultColorId={(firstRollo?.color_id as string | null) ?? null}
      />
    </div>
  )
}
