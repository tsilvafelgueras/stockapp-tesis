'use client'

import { useState } from 'react'
import { crearTintoreriaSuper } from './actions'

type Empresa = { id: string; nombre: string }

export default function NuevaTintoreriaSuperForm({
  empresas,
}: {
  empresas: Empresa[]
}) {
  const [open, setOpen] = useState(false)
  const [empresaId, setEmpresaId] = useState('')
  const [nombre, setNombre] = useState('')
  const [readerType, setReaderType] = useState<'qr' | 'barcode' | ''>('')
  const [extractionPrompt, setExtractionPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await crearTintoreriaSuper({
      empresa_id: empresaId,
      nombre,
      extractionPrompt: extractionPrompt || null,
      readerType: readerType === '' ? null : readerType,
    })

    if (result && 'error' in result && result.error) {
      setError(result.error)
      setLoading(false)
    }
    // En éxito, la action redirige a /super/tintorerias/{id}.
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        + Nueva tintorería
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Nueva tintorería</h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Empresa *</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Elegí empresa…</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Nombre *</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Ej: Tintorería Galfione"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Tipo de lector</label>
        <select
          value={readerType}
          onChange={(e) =>
            setReaderType(e.target.value as 'qr' | 'barcode' | '')
          }
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Sin configurar (lector genérico)</option>
          <option value="qr">QR (html5-qrcode)</option>
          <option value="barcode">Barcode 1D (@zxing/browser)</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">
          Prompt de extracción (opcional)
        </label>
        <textarea
          value={extractionPrompt}
          onChange={(e) => setExtractionPrompt(e.target.value)}
          rows={8}
          placeholder="Pegá el prompt específico para esta tintorería. Si lo dejás vacío, se usa el prompt default genérico."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Creando...' : 'Crear tintorería'}
      </button>
    </form>
  )
}
