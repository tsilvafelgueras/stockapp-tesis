'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { actualizarPromptYReader } from './actions'

export default function EditTintoreriaForm({
  tintoreriaId,
  initialNombre,
  initialReaderType,
  initialPrompt,
}: {
  tintoreriaId: string
  initialNombre: string
  initialReaderType: 'qr' | 'barcode' | null
  initialPrompt: string
}) {
  const router = useRouter()
  const [nombre, setNombre] = useState(initialNombre)
  const [readerType, setReaderType] = useState<'qr' | 'barcode' | ''>(
    initialReaderType ?? ''
  )
  const [extractionPrompt, setExtractionPrompt] = useState(initialPrompt)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const result = await actualizarPromptYReader({
      tintoreriaId,
      nombre,
      extractionPrompt: extractionPrompt || null,
      readerType: readerType === '' ? null : readerType,
    })

    if (!result.ok) {
      setError(result.error)
    } else {
      setSuccess(true)
      router.refresh()
    }
    setLoading(false)
  }

  function handleResetPrompt() {
    setExtractionPrompt('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-5 shadow-sm space-y-5"
    >
      <div className="space-y-1">
        <label className="text-sm font-medium">Nombre *</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
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
        <p className="text-xs text-muted-foreground">
          QR usa una librería específica de códigos QR; Barcode usa una
          librería específica de códigos de barras 1D. Sin configurar, el
          lector unificado actual acepta ambos.
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            Prompt de extracción (opcional)
          </label>
          {extractionPrompt && (
            <button
              type="button"
              onClick={handleResetPrompt}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Restablecer a default
            </button>
          )}
        </div>
        <textarea
          value={extractionPrompt}
          onChange={(e) => setExtractionPrompt(e.target.value)}
          rows={20}
          placeholder="Pegá el prompt específico para esta tintorería. Si lo dejás vacío, se usa el prompt default genérico."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Este prompt se concatena al prompt base de Gemini. El shape del JSON
          de salida se impone vía responseSchema (campos envueltos en{' '}
          <code className="font-mono">{'{ value, confidence }'}</code>), así
          que no hace falta describirlo acá.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-success bg-success/10 border border-success/20 rounded-md px-3 py-2">
          Guardado.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}
