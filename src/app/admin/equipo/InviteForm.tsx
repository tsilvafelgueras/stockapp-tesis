'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inviteTeamMember } from './actions'

export default function InviteForm() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'operario' | 'ventas' | 'admin'>('operario')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const result = await inviteTeamMember({ nombre, email, role })

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(`Invitación enviada a ${email}.`)
      setNombre('')
      setEmail('')
      setRole('operario')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-4 shadow-sm space-y-3"
    >
      <h2 className="font-semibold">Invitar usuario</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Nombre *</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Juan Pérez"
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
            placeholder="juan@empresa.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Rol *</label>
          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as 'operario' | 'ventas' | 'admin')
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="operario">Operario (depósito)</option>
            <option value="ventas">Ventas</option>
            <option value="admin">Admin (dueño)</option>
          </select>
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
