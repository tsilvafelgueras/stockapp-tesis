'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inviteSuperAdmin } from './actions'

export default function NuevoSuperAdminForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const result = await inviteSuperAdmin({ nombre, email })

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(`Se envió invitación de super-admin a ${email}.`)
      setNombre('')
      setEmail('')
      router.refresh()
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
      >
        + Invitar super-admin
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Invitar super-admin</h2>
          <p className="text-xs text-muted-foreground">
            La persona invitada va a poder operar dentro de cualquier empresa
            cliente y crear/pausar empresas.
          </p>
        </div>
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

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Nombre *</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Ej: María García"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="maria@nudostock.com"
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
        {loading ? 'Enviando...' : 'Enviar invitación'}
      </button>
    </form>
  )
}
