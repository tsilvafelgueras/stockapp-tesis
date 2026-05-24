'use client'

import { useState } from 'react'
import { createColor } from './actions'

export default function ColorForm() {
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createColor({ nombre })

    if (result.error) {
      setError(result.error)
    } else {
      setNombre('')
    }
    setLoading(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-4 shadow-sm space-y-3"
    >
      <h2 className="font-semibold">Nuevo color</h2>

      <div className="space-y-1">
        <label htmlFor="nombre" className="text-sm font-medium">
          Nombre *
        </label>
        <input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          placeholder="Ej: Azul Marino"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {/* <p className="text-xs text-muted-foreground">
          Se normaliza automáticamente: cada palabra empieza en mayúscula.
        </p> */}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Guardando...' : 'Agregar color'}
      </button>
    </form>
  )
}
