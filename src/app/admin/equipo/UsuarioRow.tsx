'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  deleteUser,
  updateUserRole,
  updateUserName,
  disableUser,
  enableUser,
} from './actions'

type Rol = 'operario' | 'ventas' | 'admin'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  operario: 'Operario',
  ventas: 'Ventas',
  super: 'Super-admin',
}

export default function UsuarioRow({
  usuario,
  esYo,
}: {
  usuario: { id: string; nombre: string; role: string; created_at: string; disabled: boolean }
  esYo: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [editandoRol, setEditandoRol] = useState(false)
  const [confirmandoDelete, setConfirmandoDelete] = useState(false)
  const [confirmandoDisable, setConfirmandoDisable] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState(usuario.nombre)
  const [rolNuevo, setRolNuevo] = useState<Rol>(
    (usuario.role as Rol) ?? 'operario'
  )

  const esSuper = usuario.role === 'super'

  function handleGuardarNombre() {
    const nombre = nombreNuevo.trim()
    if (!nombre) {
      toast.error('El nombre es obligatorio.')
      return
    }
    if (nombre === usuario.nombre) {
      setEditandoNombre(false)
      return
    }
    startTransition(async () => {
      const res = await updateUserName(usuario.id, nombre)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Nombre actualizado.')
      setEditandoNombre(false)
      router.refresh()
    })
  }

  function handleGuardarRol() {
    if (rolNuevo === usuario.role) {
      setEditandoRol(false)
      return
    }
    startTransition(async () => {
      const res = await updateUserRole(usuario.id, rolNuevo)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Rol de ${usuario.nombre} actualizado.`)
      setEditandoRol(false)
      router.refresh()
    })
  }

  function handleEliminar() {
    startTransition(async () => {
      const res = await deleteUser(usuario.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Usuario ${usuario.nombre} eliminado.`)
      setConfirmandoDelete(false)
      router.refresh()
    })
  }

  function handleDesactivar() {
    startTransition(async () => {
      const res = await disableUser(usuario.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`${usuario.nombre} desactivado. Ya no puede iniciar sesión.`)
      setConfirmandoDisable(false)
      router.refresh()
    })
  }

  function handleActivar() {
    startTransition(async () => {
      const res = await enableUser(usuario.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`${usuario.nombre} reactivado.`)
      router.refresh()
    })
  }

  const accionesDestructivas = !esYo && !esSuper

  return (
    <tr className={`border-b last:border-0 ${usuario.disabled ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3 font-medium whitespace-nowrap">
        {editandoNombre ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              disabled={pending}
              autoFocus
              className="text-sm h-8 min-h-0 w-40 rounded-md border px-2 py-1 bg-white"
            />
            <button
              type="button"
              onClick={handleGuardarNombre}
              disabled={pending}
              className="text-xs rounded-md bg-primary text-primary-foreground px-2 py-1 hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
            >
              {pending ? '…' : 'OK'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditandoNombre(false)
                setNombreNuevo(usuario.nombre)
              }}
              disabled={pending}
              className="text-xs rounded-md border px-2 py-1 hover:bg-zinc-50 disabled:opacity-50 whitespace-nowrap"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <>
            {usuario.nombre}
            {esYo && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                (vos)
              </span>
            )}
            {usuario.disabled && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-destructive">
                inactivo
              </span>
            )}
          </>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {editandoRol ? (
          <div className="flex items-center gap-1">
            <select
              value={rolNuevo}
              onChange={(e) => setRolNuevo(e.target.value as Rol)}
              className="text-xs rounded-md border px-2 py-1 bg-white"
              disabled={pending}
            >
              <option value="operario">Operario</option>
              <option value="ventas">Ventas</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              onClick={handleGuardarRol}
              disabled={pending}
              className="text-xs rounded-md bg-primary text-primary-foreground px-2 py-1 hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
            >
              {pending ? '…' : 'OK'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditandoRol(false)
                setRolNuevo(usuario.role as Rol)
              }}
              disabled={pending}
              className="text-xs rounded-md border px-2 py-1 hover:bg-zinc-50 disabled:opacity-50 whitespace-nowrap"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <span className="text-xs rounded-full px-2 py-0.5 bg-secondary text-secondary-foreground whitespace-nowrap">
            {ROLE_LABEL[usuario.role] ?? usuario.role}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
        {new Date(usuario.created_at).toLocaleDateString('es-AR')}
      </td>
      <td className="px-4 py-3 text-right">
        {esSuper ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : confirmandoDelete ? (
          <div className="flex items-center justify-end gap-1 text-xs whitespace-nowrap">
            <span className="text-muted-foreground">¿Eliminar definitivamente?</span>
            <button
              type="button"
              onClick={handleEliminar}
              disabled={pending}
              className="rounded-md bg-destructive text-white px-2 py-1 disabled:opacity-50 whitespace-nowrap"
            >
              {pending ? '…' : 'Sí, eliminar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoDelete(false)}
              disabled={pending}
              className="rounded-md border px-2 py-1 hover:bg-zinc-50 disabled:opacity-50 whitespace-nowrap"
            >
              No
            </button>
          </div>
        ) : confirmandoDisable ? (
          <div className="flex items-center justify-end gap-1 text-xs whitespace-nowrap">
            <span className="text-muted-foreground">¿Desactivar acceso?</span>
            <button
              type="button"
              onClick={handleDesactivar}
              disabled={pending}
              className="rounded-md bg-warning text-warning-foreground px-2 py-1 disabled:opacity-50 whitespace-nowrap"
            >
              {pending ? '…' : 'Sí, desactivar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoDisable(false)}
              disabled={pending}
              className="rounded-md border px-2 py-1 hover:bg-zinc-50 disabled:opacity-50 whitespace-nowrap"
            >
              No
            </button>
          </div>
        ) : (!editandoNombre && !editandoRol) && (
          <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
            <button
              type="button"
              onClick={() => setEditandoNombre(true)}
              className="text-xs rounded-md border px-2 py-1 hover:bg-zinc-50 whitespace-nowrap"
            >
              Editar nombre
            </button>
            {accionesDestructivas && (
              !usuario.disabled ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditandoRol(true)}
                    className="text-xs rounded-md border px-2 py-1 hover:bg-zinc-50 whitespace-nowrap"
                  >
                    Cambiar rol
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoDisable(true)}
                    className="text-xs rounded-md border border-warning/40 text-warning px-2 py-1 hover:bg-warning/5 whitespace-nowrap"
                  >
                    Desactivar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoDelete(true)}
                    className="text-xs rounded-md border border-destructive/40 text-destructive px-2 py-1 hover:bg-destructive/5 whitespace-nowrap"
                  >
                    Eliminar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleActivar}
                  disabled={pending}
                  className="text-xs rounded-md border border-success/40 text-success px-2 py-1 hover:bg-success/5 disabled:opacity-50 whitespace-nowrap"
                >
                  {pending ? '…' : 'Reactivar'}
                </button>
              )
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
