'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { crearCliente, editarCliente, type ClienteInput } from './actions'

export default function ClienteForm({
  cliente,
  onDone,
}: {
  cliente?: {
    id: string
    nombre: string
    contacto: string | null
    email: string | null
    telefono: string | null
    direccion: string | null
    notas: string | null
  }
  onDone?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [contacto, setContacto] = useState(cliente?.contacto ?? '')
  const [email, setEmail] = useState(cliente?.email ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [direccion, setDireccion] = useState(cliente?.direccion ?? '')
  const [notas, setNotas] = useState(cliente?.notas ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input: ClienteInput = {
      nombre,
      contacto,
      email,
      telefono,
      direccion,
      notas,
    }
    startTransition(async () => {
      const res = cliente
        ? await editarCliente(cliente.id, input)
        : await crearCliente(input)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(cliente ? 'Cliente actualizado.' : 'Cliente creado.')
      if (!cliente) {
        setNombre('')
        setContacto('')
        setEmail('')
        setTelefono('')
        setDireccion('')
        setNotas('')
      }
      router.refresh()
      onDone?.()
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-4 shadow-sm space-y-3"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">
            Nombre *
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Ej. Confecciones Pérez"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Contacto
          </label>
          <input
            type="text"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            placeholder="Nombre del referente"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contacto@empresa.com"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Teléfono
          </label>
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="011..."
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Dirección
          </label>
          <input
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Calle, número, ciudad"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">
            Notas
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Detalles, preferencias, condiciones de pago, etc."
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            disabled={pending}
            className="rounded-md border bg-white px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={pending || !nombre.trim()}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {pending
            ? 'Guardando…'
            : cliente
              ? 'Guardar cambios'
              : 'Crear cliente'}
        </button>
      </div>
    </form>
  )
}
