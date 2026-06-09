'use client'

import { useState } from 'react'
import { createColor } from './actions'

function toTitleCase(str: string): string {
  return str.trim().replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

export default function ColorForm({
  colores = [],
}: {
  colores?: { id: string; nombre: string }[]
}) {
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingColor, setPendingColor] = useState<string | null>(null)

  const normalized = toTitleCase(nombre)
  const isDuplicate =
    nombre.trim().length > 0 &&
    colores.some(
      (c) => c.nombre.toLowerCase() === normalized.toLowerCase()
    )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isDuplicate) return
    setError(null)
    setPendingColor(normalized)
  }

  async function handleConfirm() {
    if (!pendingColor) return
    setLoading(true)
    const result = await createColor({ nombre: pendingColor })
    setLoading(false)
    setPendingColor(null)
    if (result.error || ('alreadyExists' in result && result.alreadyExists)) {
      setError(
        result.error ?? `El color "${pendingColor}" ya existe en el catálogo.`
      )
    } else {
      setNombre('')
      setError(null)
    }
  }

  function handleCancel() {
    setPendingColor(null)
  }

  return (
    <>
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
            onChange={(e) => {
              setNombre(e.target.value)
              setError(null)
            }}
            required
            placeholder="Ej: Azul Marino"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {isDuplicate && (
            <p className="text-xs text-destructive">
              Este color ya existe en el catálogo.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={loading || isDuplicate || !nombre.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          Agregar color
        </button>
      </form>

      {pendingColor && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-sm w-full space-y-6 text-center">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                ¿Estás seguro que querés crear este color?
              </p>
              <p className="text-4xl font-bold break-words">{pendingColor}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="rounded-md border px-5 py-2 text-sm transition-colors hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Guardando...' : 'Sí, crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
