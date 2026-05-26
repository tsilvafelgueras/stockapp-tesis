'use client'

import { useState } from 'react'
import { asociarTintoreria } from './actions'

type TintoreriaOption = { id: string; nombre: string }

export default function TintoreriaForm({
  tintoreriasDisponibles,
}: {
  tintoreriasDisponibles: TintoreriaOption[]
}) {
  const [tintoreriaId, setTintoreriaId] = useState('')
  const [contacto, setContacto] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await asociarTintoreria(tintoreriaId, {
      contacto,
      email,
      telefono,
    })

    if ('error' in result) {
      setError(result.error)
    } else {
      setTintoreriaId('')
      setContacto('')
      setEmail('')
      setTelefono('')
    }
    setLoading(false)
  }

  if (tintoreriasDisponibles.length === 0) {
    return (
      <div className="rounded-lg border bg-zinc-50 p-4 text-sm text-muted-foreground">
        No hay tintorerías disponibles para asociar. Si necesitás una nueva,
        pedile al superadmin que la cree.
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-4 shadow-sm space-y-3"
    >
      <h2 className="font-semibold">Asociar tintorería</h2>
      <p className="text-xs text-muted-foreground">
        Elegí una tintorería del registro global. Si no aparece, el superadmin
        tiene que crearla primero.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="tintoreria_id" className="text-sm font-medium">
            Tintorería *
          </label>
          <select
            id="tintoreria_id"
            value={tintoreriaId}
            onChange={(e) => setTintoreriaId(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Elegí una tintorería…</option>
            {tintoreriasDisponibles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="contacto" className="text-sm font-medium">
            Persona de contacto
          </label>
          <input
            id="contacto"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            placeholder="Ej: Juan Pérez"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contacto@tintoreria.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="telefono" className="text-sm font-medium">
            Teléfono
          </label>
          <input
            id="telefono"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="11 4444-5555"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading || !tintoreriaId}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Asociando...' : 'Asociar tintorería'}
      </button>
    </form>
  )
}
