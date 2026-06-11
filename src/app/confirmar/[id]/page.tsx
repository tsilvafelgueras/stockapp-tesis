import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import BackButton from '@/components/BackButton'
import { getUbicacionesActivas } from '@/lib/ubicacionesServer'
import ConfirmarPartidaForm, { type RolloPartida } from './ConfirmarPartidaForm'

export default async function ConfirmarIngresoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: ingreso } = await supabase
    .from('ingresos')
    .select(`
      id, fecha_despacho, numero_remito, estado, total_rollos_declarado,
      tintorerias ( nombre ),
      articulos ( nombre )
    `)
    .eq('id', id)
    .single()

  if (!ingreso) notFound()

  if (ingreso.estado === 'confirmado') {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
        <BackButton href="/confirmar" label="Volver a confirmaciones" />
        <div className="rounded-lg border bg-success/10 border-success/30 p-5 text-center space-y-2">
          <p className="text-2xl">✓</p>
          <p className="font-semibold text-success">Ingreso ya confirmado</p>
          <p className="text-sm text-muted-foreground">
            Todos los rollos de este ingreso fueron confirmados.
          </p>
        </div>
      </div>
    )
  }

  // Nota: el color del rollo se resuelve con una query aparte + map por
  // color_id (igual que en pedidos/stock/reportes). El embed PostgREST
  // `colores ( nombre )` sobre `rollos` NO resuelve la relación y hace fallar
  // toda la query (devolvía rollos=[] → parecía "sin pendientes").
  const [{ data: rollosData }, { data: coloresRaw }, ubicaciones] = await Promise.all([
    supabase
      .from('rollos')
      .select(`
        id, numero_pieza, estado, color_id, ubicacion,
        articulos ( nombre )
      `)
      .eq('ingreso_id', id)
      .eq('estado', 'pendiente')
      .order('numero_pieza'),
    supabase.from('colores').select('id, nombre'),
    getUbicacionesActivas(supabase),
  ])

  const colorById = new Map(
    ((coloresRaw ?? []) as { id: string; nombre: string }[]).map((c) => [
      c.id,
      c.nombre,
    ])
  )

  const tintoreria = (
    ingreso.tintorerias as unknown as { nombre: string } | null
  )?.nombre
  const articulo = (
    ingreso.articulos as unknown as { nombre: string } | null
  )?.nombre

  const rollos: RolloPartida[] = (rollosData ?? []).map((r) => ({
    id: r.id as string,
    numero_pieza: r.numero_pieza as string,
    articulo: (r.articulos as unknown as { nombre: string } | null)?.nombre ?? null,
    color: r.color_id ? colorById.get(r.color_id as string) ?? null : null,
    ubicacion: (r.ubicacion as string | null) ?? null,
  }))

  // Si todos los rollos pendientes comparten la misma ubicación no-nula, la
  // pre-cargamos en el formulario para que el operario no tenga que re-ingresarla.
  const ubicacionesUnicas = [
    ...new Set(rollos.map((r) => r.ubicacion).filter((u): u is string => Boolean(u))),
  ]
  const ubicacionComun = ubicacionesUnicas.length === 1 ? ubicacionesUnicas[0] : undefined

  // Si TODOS los rollos pendientes ya tienen ubicación (caso típico de ingreso
  // cargado a mano), no hace falta volver a pedirla al confirmar.
  const todosTienenUbicacion =
    rollos.length > 0 && rollos.every((r) => Boolean(r.ubicacion))

  const pendientes = rollos.length

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <BackButton href="/confirmar" label="Volver a confirmaciones" />
        <h1 className="text-xl font-bold mt-2">Confirmar llegadas</h1>
        <p className="text-sm text-muted-foreground">
          {tintoreria ?? '—'} · {ingreso.fecha_despacho}
          {ingreso.numero_remito ? ` · Rem. ${ingreso.numero_remito}` : ''}
        </p>
        {articulo && (
          <p className="text-xs text-muted-foreground mt-0.5">{articulo}</p>
        )}
      </div>

      {pendientes === 0 ? (
        <div className="rounded-lg border bg-success/10 border-success/30 p-5 text-center space-y-2">
          <p className="text-2xl">✓</p>
          <p className="font-semibold text-success">
            Esta partida ya no tiene rollos pendientes
          </p>
          <p className="text-sm text-muted-foreground">
            Ya fueron confirmados. Volvé para confirmar otra llegada.
          </p>
        </div>
      ) : (
        <ConfirmarPartidaForm
          ingresoId={id}
          rollos={rollos}
          totalDeclarado={ingreso.total_rollos_declarado}
          ubicaciones={ubicaciones}
          ubicacionPrevia={ubicacionComun}
          todosTienenUbicacion={todosTienenUbicacion}
        />
      )}
    </div>
  )
}
