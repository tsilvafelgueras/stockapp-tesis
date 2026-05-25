'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Mail, Phone, User } from 'lucide-react'
import {
  darDeBajaTintoreria,
  editarTintoreria,
  eliminarTintoreria,
  reactivarTintoreria,
} from './actions'

type Mode = 'view' | 'edit' | 'confirmar-baja' | 'confirmar-eliminar'

export default function TintoreriaRow({
  id,
  nombre,
  activo,
  createdAt,
  fechaBaja,
  contacto,
  email,
  telefono,
}: {
  id: string
  nombre: string
  activo: boolean
  createdAt: string
  fechaBaja: string | null
  contacto: string | null
  email: string | null
  telefono: string | null
}) {
  const [mode, setMode] = useState<Mode>('view')
  const [nombreVal, setNombreVal] = useState(nombre)
  const [contactoVal, setContactoVal] = useState(contacto ?? '')
  const [emailVal, setEmailVal] = useState(email ?? '')
  const [telefonoVal, setTelefonoVal] = useState(telefono ?? '')
  const [pending, startTransition] = useTransition()

  function resetForm() {
    setNombreVal(nombre)
    setContactoVal(contacto ?? '')
    setEmailVal(email ?? '')
    setTelefonoVal(telefono ?? '')
  }

  function guardar() {
    const limpio = nombreVal.trim()
    if (!limpio) {
      toast.error('El nombre no puede estar vacío.')
      return
    }
    startTransition(async () => {
      const res = await editarTintoreria(id, {
        nombre: limpio,
        contacto: contactoVal,
        email: emailVal,
        telefono: telefonoVal,
      })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Tintorería actualizada.')
      setMode('view')
    })
  }

  function darDeBaja() {
    startTransition(async () => {
      const res = await darDeBajaTintoreria(id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(`"${nombre}" dada de baja.`)
      setMode('view')
    })
  }

  function reactivar() {
    startTransition(async () => {
      const res = await reactivarTintoreria(id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(`"${nombre}" reactivada.`)
    })
  }

  function eliminar() {
    startTransition(async () => {
      const res = await eliminarTintoreria(id)
      if ('error' in res) {
        toast.error(res.error)
        setMode('view')
        return
      }
      toast.success(`"${nombre}" eliminada.`)
    })
  }

  if (mode === 'edit') {
    return (
      <tr className="border-b last:border-0 bg-accent/40">
        <td colSpan={4} className="px-4 py-4">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Nombre *
                </label>
                <input
                  value={nombreVal}
                  onChange={(e) => setNombreVal(e.target.value)}
                  autoFocus
                  className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Persona de contacto
                </label>
                <input
                  value={contactoVal}
                  onChange={(e) => setContactoVal(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Email
                </label>
                <input
                  type="email"
                  value={emailVal}
                  onChange={(e) => setEmailVal(e.target.value)}
                  placeholder="contacto@tintoreria.com"
                  className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={telefonoVal}
                  onChange={(e) => setTelefonoVal(e.target.value)}
                  placeholder="11 4444-5555"
                  className="w-full rounded-md border bg-white px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setMode('view')
                }}
                disabled={pending}
                className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={pending}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {pending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  if (mode === 'confirmar-baja') {
    return (
      <tr className="border-b last:border-0 bg-amber-50">
        <td className="px-4 py-3 text-sm" colSpan={3}>
          ¿Dar de baja a <strong>{nombre}</strong>? Vas a poder reactivarla más
          adelante si retoman la relación.
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode('view')}
              disabled={pending}
              className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={darDeBaja}
              disabled={pending}
              className="rounded-md bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {pending ? 'Dando de baja…' : 'Dar de baja'}
            </button>
          </div>
        </td>
      </tr>
    )
  }

  if (mode === 'confirmar-eliminar') {
    return (
      <tr className="border-b last:border-0 bg-destructive/5">
        <td className="px-4 py-3 text-sm" colSpan={3}>
          ¿Eliminar <strong>{nombre}</strong>? Si tiene ingresos cargados, esta
          acción va a fallar y vas a tener que darla de baja.
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode('view')}
              disabled={pending}
              className="rounded-md border px-3 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={eliminar}
              disabled={pending}
              className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              {pending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </td>
      </tr>
    )
  }

  const tieneContacto = !!(contacto || email || telefono)

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-4 py-3">
        <div className="font-medium">{nombre}</div>
        {tieneContacto && (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {contacto && (
              <li className="flex items-center gap-1.5">
                <User className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{contacto}</span>
              </li>
            )}
            {email && (
              <li className="flex items-center gap-1.5">
                <Mail className="size-3 shrink-0" aria-hidden />
                <a
                  href={`mailto:${email}`}
                  className="truncate hover:text-foreground hover:underline"
                >
                  {email}
                </a>
              </li>
            )}
            {telefono && (
              <li className="flex items-center gap-1.5">
                <Phone className="size-3 shrink-0" aria-hidden />
                <a
                  href={`tel:${telefono.replace(/\s+/g, '')}`}
                  className="truncate hover:text-foreground hover:underline"
                >
                  {telefono}
                </a>
              </li>
            )}
          </ul>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
        {formatFecha(createdAt)}
      </td>
      <td className="px-4 py-3 text-xs">
        {activo ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">
            Activa
          </span>
        ) : (
          <div className="flex flex-col">
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-muted-foreground">
              Dada de baja
            </span>
            {fechaBaja && (
              <span className="mt-0.5 tabular-nums text-muted-foreground/80">
                {formatFecha(fechaBaja)}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-nowrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setMode('edit')}
            disabled={pending}
            className="whitespace-nowrap rounded-md border px-2.5 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
          >
            Editar
          </button>
          {activo ? (
            <button
              type="button"
              onClick={() => setMode('confirmar-baja')}
              disabled={pending}
              className="whitespace-nowrap rounded-md border border-amber-400/40 text-amber-700 px-2.5 py-1 text-xs hover:bg-amber-50 disabled:opacity-50"
            >
              Dar de baja
            </button>
          ) : (
            <button
              type="button"
              onClick={reactivar}
              disabled={pending}
              className="whitespace-nowrap rounded-md border border-success/40 text-success px-2.5 py-1 text-xs hover:bg-success/5 disabled:opacity-50"
            >
              Reactivar
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('confirmar-eliminar')}
            disabled={pending}
            className="whitespace-nowrap rounded-md border border-destructive/40 text-destructive px-2.5 py-1 text-xs hover:bg-destructive/5 disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </td>
    </tr>
  )
}

function formatFecha(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
