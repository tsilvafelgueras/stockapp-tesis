'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export type ExcelFilterOption = {
  value: string
  label: string
  count?: number
}

/**
 * Dropdown estilo "filtro de tabla Excel": chip que dispara un panel con
 * search-bar arriba y checkboxes abajo (selección múltiple). El padre maneja
 * la lista de valores seleccionados — este componente solo emite cambios.
 *
 * Convención: `selected` vacío = "todos" (no filtra). El usuario explícitamente
 * elige uno o varios para filtrar.
 */
export default function ExcelFilter({
  label,
  options,
  selected,
  onChange,
  emptyLabel = '(vacío)',
  align = 'start',
  triggerClassName,
  panelClassName,
}: {
  label: string
  options: ExcelFilterOption[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Texto a mostrar para la opción "valor vacío" si aparece. */
  emptyLabel?: string
  align?: 'start' | 'end'
  /** Clases extra para el botón disparador (override de tamaño/ancho). */
  triggerClassName?: string
  /** Clases extra para el panel desplegable (override del ancho w-64). */
  panelClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    inputRef.current?.focus()
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [query, options])

  const activos = selected.length
  const totalOpts = options.length

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  function selectAllFiltered() {
    const merged = new Set([...selected, ...filtered.map((o) => o.value)])
    onChange([...merged])
  }

  function clearAll() {
    onChange([])
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
          activos > 0
            ? 'border-primary/40 bg-primary/5 text-primary'
            : 'border-input bg-white hover:bg-zinc-50 text-foreground',
          triggerClassName
        )}
      >
        <span className="flex-1 truncate text-left">{label}</span>
        {activos > 0 && (
          <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5 min-w-[18px] text-center">
            {activos}
          </span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-30 mt-1 w-64 rounded-lg border bg-white shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName
          )}
        >
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex items-center justify-between mt-2 text-xs">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-primary hover:underline"
              >
                Seleccionar todo
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={activos === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Limpiar
              </button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-center text-muted-foreground">
                Sin resultados
              </p>
            ) : (
              filtered.map((opt) => {
                const checked = selected.includes(opt.value)
                const display = opt.label === '' ? emptyLabel : opt.label
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      className="rounded border-input"
                    />
                    <span className="flex-1 truncate">{display}</span>
                    {opt.count !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {opt.count}
                      </span>
                    )}
                  </label>
                )
              })
            )}
          </div>
          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>
              {activos} de {totalOpts}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-primary hover:underline"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
