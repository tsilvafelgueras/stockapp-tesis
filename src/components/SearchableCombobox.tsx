'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export type SearchableOption = {
  value: string
  label: string
  description?: string
}

export default function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = 'Buscar...',
  emptyLabel = 'Sin resultados',
  disabled = false,
  allowClear = true,
  className = '',
}: {
  options: SearchableOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  searchPlaceholder?: string
  emptyLabel?: string
  disabled?: boolean
  allowClear?: boolean
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = options.find((o) => o.value === value) ?? null
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) =>
      `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q)
    )
  }, [options, query])

  function close() {
    setOpen(false)
    setQuery('')
  }

  // Cierre por "click afuera" (pointerdown a nivel documento). Reemplaza al
  // onBlur + flag de touch: así las opciones se seleccionan con un onClick
  // simple y la lista se puede SCROLLEAR con el dedo en mobile (no hay
  // preventDefault en pointerdown que bloquee el scroll nativo).
  useEffect(() => {
    if (!open) return
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="flex min-h-10 items-center rounded-md border bg-white text-sm focus-within:ring-2 focus-within:ring-ring">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className={
              selected
                ? 'truncate text-foreground'
                : 'truncate text-muted-foreground'
            }
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
        {allowClear && value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              close()
            }}
            className="mr-1 rounded p-1 text-muted-foreground hover:bg-zinc-100 hover:text-foreground"
            aria-label="Limpiar seleccion"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div
            className="max-h-56 overflow-y-auto py-1 [touch-action:pan-y] [overscroll-behavior:contain]"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                {emptyLabel}
              </p>
            ) : (
              filtered.map((option) => {
                const active = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-no-ripple
                    onClick={() => {
                      onChange(option.value)
                      close()
                    }}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50 ${
                      active ? 'bg-accent/50' : ''
                    }`}
                  >
                    <Check
                      className={`mt-0.5 size-4 shrink-0 ${
                        active ? 'text-action' : 'text-transparent'
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {option.label}
                      </span>
                      {option.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
