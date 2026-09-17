'use client'

import { useState } from 'react'
import { solicitarArticulo } from '@/app/admin/articulos/solicitudes-actions'

export default function ArticulosDetectados({ grupos, onAsignar, disabled }: {
  grupos: { clave: string; nombre: string; cantidad: number }[]
  onAsignar: (clave: string, articulo: { id: string; nombre: string; pendiente: boolean }) => void
  disabled: boolean
}) {
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [procesando, setProcesando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!grupos.length) return null

  async function solicitar(clave: string, nombre: string) {
    setProcesando(clave)
    setError(null)
    try {
      const result = await solicitarArticulo(nombre)
      if (result.error) setError(result.error)
      else if (result.articulo) onAsignar(clave, result.articulo)
    } catch {
      setError('No se pudo enviar la solicitud. Volvé a intentar.')
    } finally { setProcesando(null) }
  }

  return <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-3">
    <p className="font-medium text-sm">Artículos nuevos detectados</p>
    <p className="text-sm">Revisá el nombre y solicitá la aprobación del administrador. Los rollos se pueden guardar mientras esperan.</p>
    {grupos.map(grupo => <div key={grupo.clave} className="flex flex-wrap items-center gap-2">
      <input aria-label={`Nombre del artículo detectado: ${grupo.nombre}`} maxLength={150}
        className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        value={nombres[grupo.clave] ?? grupo.nombre} disabled={disabled || procesando !== null}
        onChange={e => setNombres(prev => ({ ...prev, [grupo.clave]: e.target.value }))} />
      <span className="text-xs">{grupo.cantidad} rollo{grupo.cantidad === 1 ? '' : 's'}</span>
      <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
        disabled={disabled || procesando !== null || !(nombres[grupo.clave] ?? grupo.nombre).trim()}
        onClick={() => solicitar(grupo.clave, nombres[grupo.clave] ?? grupo.nombre)}>
        {procesando === grupo.clave ? 'Solicitando...' : 'Solicitar y asignar'}
      </button>
    </div>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>
}
