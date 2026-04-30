'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEmpresaConAdmin } from './actions'

export default function NuevaEmpresaForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [adminNombre, setAdminNombre] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const result = await createEmpresaConAdmin({
      empresa_nombre: empresaNombre,
      admin_nombre: adminNombre,
      admin_email: adminEmail,
    })

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(
        `Empresa "${empresaNombre}" creada. Se envió invitación a ${adminEmail}.`
      )
      setEmpresaNombre('')
      setAdminNombre('')
      setAdminEmail('')
      router.refresh()
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        + Nueva empresa
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Nueva empresa</h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
            setSuccess(null)
          }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Nombre de la empresa *</label>
        <input
          type="text"
          value={empresaNombre}
          onChange={(e) => setEmpresaNombre(e.target.value)}
          required
          placeholder="Ej: Textil Dakuba"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Nombre del primer admin *</label>
          <input
            type="text"
            value={adminNombre}
            onChange={(e) => setAdminNombre(e.target.value)}
            required
            placeholder="Ej: Juan Pérez"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Email del admin *</label>
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
            placeholder="juan@dakuba.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-success bg-success/10 border border-success/20 rounded-md px-3 py-2">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Creando...' : 'Crear y enviar invitación'}
      </button>
    </form>
  )
}
