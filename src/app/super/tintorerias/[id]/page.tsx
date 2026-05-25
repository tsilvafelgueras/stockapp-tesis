import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import EditTintoreriaForm from '../EditTintoreriaForm'

export default async function SuperEditTintoreriaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: tintoreria } = await admin
    .from('tintorerias')
    .select(
      'id, nombre, empresa_id, activo, reader_type, extraction_prompt, contacto, email, telefono'
    )
    .eq('id', id)
    .maybeSingle()

  if (!tintoreria) notFound()

  const { data: empresa } = await admin
    .from('empresas')
    .select('nombre')
    .eq('id', tintoreria.empresa_id)
    .maybeSingle()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/super/tintorerias"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Volver a tintorerías
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{tintoreria.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          Empresa: {empresa?.nombre ?? '—'}
          {!tintoreria.activo && (
            <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs">
              Dada de baja
            </span>
          )}
        </p>
      </div>

      <EditTintoreriaForm
        tintoreriaId={tintoreria.id}
        initialReaderType={
          tintoreria.reader_type as 'qr' | 'barcode' | null
        }
        initialPrompt={tintoreria.extraction_prompt ?? ''}
      />

      <div className="rounded-lg border bg-zinc-50 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Datos administrados por la empresa</p>
        <ul className="mt-2 space-y-1">
          <li>Contacto: {tintoreria.contacto ?? '—'}</li>
          <li>Email: {tintoreria.email ?? '—'}</li>
          <li>Teléfono: {tintoreria.telefono ?? '—'}</li>
        </ul>
        <p className="mt-2">
          Estos campos los edita el admin de la empresa desde su sección de
          administración. Acá solo se muestran como referencia.
        </p>
      </div>
    </div>
  )
}
