import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import EditTintoreriaForm from '../EditTintoreriaForm'
import EmpresasAsociadas from '../EmpresasAsociadas'

export default async function SuperEditTintoreriaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: tintoreria } = await admin
    .from('tintorerias')
    .select('id, nombre, reader_type, extraction_prompt')
    .eq('id', id)
    .maybeSingle()

  if (!tintoreria) notFound()

  const [{ data: empresas }, { data: links }] = await Promise.all([
    admin.from('empresas').select('id, nombre').order('nombre'),
    admin
      .from('empresa_tintorerias')
      .select('empresa_id, contacto, email, telefono, activo, fecha_baja, created_at')
      .eq('tintoreria_id', id),
  ])

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
          Registro maestro global. Las asociaciones con empresas se gestionan
          en la sección de abajo.
        </p>
      </div>

      <EditTintoreriaForm
        tintoreriaId={tintoreria.id}
        initialNombre={tintoreria.nombre}
        initialReaderType={
          tintoreria.reader_type as 'qr' | 'barcode' | null
        }
        initialPrompt={tintoreria.extraction_prompt ?? ''}
      />

      <EmpresasAsociadas
        tintoreriaId={tintoreria.id}
        empresas={empresas ?? []}
        links={links ?? []}
      />
    </div>
  )
}
