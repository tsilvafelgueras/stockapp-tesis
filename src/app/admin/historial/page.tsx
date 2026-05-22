import { createClient } from '@/lib/supabase/server'
import DashboardBackButton from '@/components/DashboardBackButton'
import HistorialFilters from './HistorialFilters'

type SearchParams = {
  entidad?: string
  accion?: string
  usuario?: string
  desde?: string
  hasta?: string
}

const ENTIDAD_LABEL: Record<string, string> = {
  rollo: 'Rollo',
  pedido: 'Pedido',
  ingreso: 'Ingreso',
  pedido_rollo: 'Asignación de rollo',
  muestra: 'Muestra',
}

const ACCION_LABEL: Record<string, { text: string; className: string }> = {
  crear: { text: 'Creación', className: 'bg-success/15 text-success' },
  actualizar: { text: 'Actualización', className: 'bg-primary/15 text-primary' },
  cambiar_estado: { text: 'Estado', className: 'bg-warning/15 text-warning' },
  auditar: { text: 'Auditoría', className: 'bg-zinc-100 text-zinc-700' },
  asignar_rollo: { text: 'Asignación', className: 'bg-primary/15 text-primary' },
  desasignar_rollo: { text: 'Desasignación', className: 'bg-zinc-100 text-zinc-700' },
  pickear: { text: 'Picking', className: 'bg-success/15 text-success' },
  eliminar: { text: 'Eliminación', className: 'bg-destructive/15 text-destructive' },
}

type Movimiento = {
  id: string
  entidad: string
  entidad_id: string
  accion: string
  usuario_id: string | null
  detalle: Record<string, unknown> | null
  created_at: string
}

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  // RLS ya restringe a admin/super, pero reforzamos un mensaje claro.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'super') {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          Solo el administrador puede ver el historial.
        </p>
      </div>
    )
  }

  let query = supabase
    .from('movimientos')
    .select('id, entidad, entidad_id, accion, usuario_id, detalle, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (sp.entidad) query = query.eq('entidad', sp.entidad)
  if (sp.accion) query = query.eq('accion', sp.accion)
  if (sp.usuario) query = query.eq('usuario_id', sp.usuario)
  if (sp.desde) query = query.gte('created_at', sp.desde)
  if (sp.hasta) {
    const hasta = new Date(sp.hasta)
    hasta.setDate(hasta.getDate() + 1)
    query = query.lt('created_at', hasta.toISOString().slice(0, 10))
  }

  const { data: movimientosRaw, error } = await query
  const movimientos = (movimientosRaw ?? []) as unknown as Movimiento[]

  // Lista de usuarios de la empresa (sirve tanto para el dropdown del filtro
  // como para mostrar el nombre/rol del autor en cada fila).
  const { data: usuariosLista } = await supabase
    .from('profiles')
    .select('id, nombre, role')
    .order('nombre')

  const usuarioMap = new Map<string, { nombre: string; role: string }>()
  for (const u of usuariosLista ?? []) {
    usuarioMap.set(u.id, { nombre: u.nombre, role: u.role })
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <DashboardBackButton />
        <h1 className="text-xl sm:text-2xl font-bold mt-1">
          Historial de movimientos
        </h1>
        <p className="text-sm text-muted-foreground">
          Registro inborrable de cambios en rollos, pedidos, ingresos y muestras.
        </p>
      </div>

      <HistorialFilters
        current={{
          entidad: sp.entidad ?? '',
          accion: sp.accion ?? '',
          usuario: sp.usuario ?? '',
          desde: sp.desde ?? '',
          hasta: sp.hasta ?? '',
        }}
        usuarios={usuariosLista ?? []}
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Error al cargar el historial: {error.message}
        </div>
      )}

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium w-44">Cuándo</th>
                <th className="px-4 py-3 font-medium w-32">Entidad</th>
                <th className="px-4 py-3 font-medium w-32">Acción</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
                <th className="px-4 py-3 font-medium w-44">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Sin movimientos para los filtros activos.
                  </td>
                </tr>
              ) : (
                movimientos.map((m) => {
                  const usuario = m.usuario_id
                    ? usuarioMap.get(m.usuario_id)
                    : undefined
                  const accion =
                    ACCION_LABEL[m.accion] ?? {
                      text: m.accion,
                      className: 'bg-zinc-100 text-zinc-700',
                    }
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-4 py-2 align-top tabular-nums text-xs text-muted-foreground">
                        {fechaCorta(m.created_at)}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <span className="text-xs rounded-full bg-zinc-100 px-2 py-0.5">
                          {ENTIDAD_LABEL[m.entidad] ?? m.entidad}
                        </span>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 ${accion.className}`}
                        >
                          {accion.text}
                        </span>
                      </td>
                      <td className="px-4 py-2 align-top text-sm">
                        {describirDetalle(m)}
                      </td>
                      <td className="px-4 py-2 align-top text-xs">
                        {usuario ? (
                          <div>
                            <p className="font-medium text-foreground">
                              {usuario.nombre}
                            </p>
                            <p className="text-muted-foreground">
                              {usuario.role}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {movimientos.length === 500 && (
          <p className="px-4 py-2 text-xs text-muted-foreground border-t bg-zinc-50">
            Mostrando los 500 movimientos más recientes con esos filtros.
            Estrechá los filtros para ver más atrás.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function fechaCorta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function describirDetalle(m: Movimiento) {
  const d = m.detalle ?? {}
  const cambios = (d.cambios ?? null) as Record<string, unknown> | null

  if (m.entidad === 'rollo') {
    const pieza = (d.numero_pieza as string | undefined) ?? '—'
    if (m.accion === 'crear') {
      return (
        <p>
          Creó el rollo <strong>Nº {pieza}</strong>
          {d.estado ? ` (estado: ${d.estado as string})` : ''}
          {d.ubicacion ? ` · ubic. ${d.ubicacion as string}` : ''}
        </p>
      )
    }
    if (m.accion === 'eliminar') {
      return (
        <p>
          Eliminó el rollo <strong>Nº {pieza}</strong>
        </p>
      )
    }
    if (m.accion === 'auditar') {
      return (
        <p>
          Auditó el rollo <strong>Nº {pieza}</strong>
        </p>
      )
    }
    return (
      <div>
        <p>
          Modificó el rollo <strong>Nº {pieza}</strong>:
        </p>
        {cambios && <CambiosList cambios={cambios} />}
      </div>
    )
  }

  if (m.entidad === 'pedido') {
    const numero = (d.numero_pedido as string | undefined) ?? '—'
    if (m.accion === 'crear') {
      return (
        <p>
          Creó el pedido <strong>{numero}</strong> para{' '}
          <strong>{(d.cliente as string) ?? '—'}</strong>
        </p>
      )
    }
    if (m.accion === 'eliminar') {
      return (
        <p>
          Eliminó el pedido <strong>{numero}</strong>
        </p>
      )
    }
    return (
      <div>
        <p>
          Modificó el pedido <strong>{numero}</strong>:
        </p>
        {cambios && <CambiosList cambios={cambios} />}
      </div>
    )
  }

  if (m.entidad === 'ingreso') {
    const remito = (d.numero_remito as string | undefined) ?? '—'
    if (m.accion === 'crear') {
      return (
        <p>
          Creó el ingreso con remito <strong>{remito}</strong>
        </p>
      )
    }
    if (m.accion === 'eliminar') {
      return (
        <p>
          Eliminó el ingreso (remito {remito})
        </p>
      )
    }
    return (
      <div>
        <p>
          Modificó el ingreso (remito {remito}):
        </p>
        {cambios && <CambiosList cambios={cambios} />}
      </div>
    )
  }

  if (m.entidad === 'pedido_rollo') {
    if (m.accion === 'pickear') {
      return <p>Pickeó un rollo del pedido</p>
    }
    if (m.accion === 'asignar_rollo') {
      return <p>Asignó un rollo a un pedido</p>
    }
    if (m.accion === 'desasignar_rollo') {
      return <p>Quitó un rollo de un pedido</p>
    }
  }

  if (m.entidad === 'muestra') {
    if (m.accion === 'crear') {
      return (
        <p>
          Registró muestra de{' '}
          <strong>{String(d.kilos_descontados ?? '?')} kg</strong> para{' '}
          <strong>{(d.cliente as string) ?? '—'}</strong>
        </p>
      )
    }
    if (m.accion === 'eliminar') {
      return <p>Eliminó una muestra</p>
    }
  }

  return (
    <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
      {JSON.stringify(d, null, 2)}
    </pre>
  )
}

function CambiosList({ cambios }: { cambios: Record<string, unknown> }) {
  const entries = Object.entries(cambios)
  if (entries.length === 0) return null
  return (
    <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
      {entries.map(([campo, valor]) => {
        if (Array.isArray(valor) && valor.length === 2) {
          return (
            <li key={campo}>
              · <strong>{labelCampo(campo)}</strong>:{' '}
              <span className="line-through">{formatVal(valor[0])}</span> →{' '}
              <span className="text-foreground">{formatVal(valor[1])}</span>
            </li>
          )
        }
        return (
          <li key={campo}>
            · <strong>{labelCampo(campo)}</strong>: {formatVal(valor)}
          </li>
        )
      })}
    </ul>
  )
}

function labelCampo(campo: string): string {
  const map: Record<string, string> = {
    estado: 'estado',
    ubicacion: 'ubicación',
    kilos: 'kilos',
    kilos_propios: 'kilos propios',
    articulo_id: 'artículo',
    tintoreria_id: 'tintorería',
    cliente: 'cliente',
    numero_remito_externo: 'remito externo',
    numero_remito: 'remito',
    fecha_despacho: 'fecha despacho',
    total_rollos_declarado: 'rollos declarados',
    total_kilos_declarado: 'kilos declarados',
    auditado_at: 'auditoría',
  }
  return map[campo] ?? campo
}

function formatVal(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v)
  }
  return JSON.stringify(v)
}
