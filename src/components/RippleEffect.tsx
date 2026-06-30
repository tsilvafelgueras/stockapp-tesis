'use client'

import { useEffect } from 'react'

/**
 * Efecto "onda" (ripple) global al tocar cualquier botón / pestaña / módulo.
 * Se monta una sola vez en el root layout y usa un listener delegado de
 * pointerdown en el documento — no hay que tocar botón por botón.
 *
 * Una pieza se puede excluir con `data-no-ripple` (ej. items con badge absoluto
 * que el overflow:hidden recortaría). Los `<a>`/`Link` que actúan como
 * pestaña/módulo se marcan con `data-ripple` para participar.
 */
export default function RippleEffect() {
  useEffect(() => {
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches
    if (reduce) return

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      const start = e.target as Element | null
      const el = start?.closest<HTMLElement>(
        'button:not([data-no-ripple]), [role="tab"], a[data-ripple], [role="button"]'
      )
      if (!el) return
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
        return
      }

      const rect = el.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height)

      const cs = getComputedStyle(el)
      if (cs.position === 'static') el.style.position = 'relative'
      if (cs.overflow !== 'hidden') {
        if (el.dataset.ripplePrevOverflow === undefined) {
          el.dataset.ripplePrevOverflow = el.style.overflow || ''
        }
        el.style.overflow = 'hidden'
      }

      const span = document.createElement('span')
      span.className = 'ripple-ink'
      span.style.width = `${size}px`
      span.style.height = `${size}px`
      span.style.left = `${e.clientX - rect.left - size / 2}px`
      span.style.top = `${e.clientY - rect.top - size / 2}px`
      el.appendChild(span)

      span.addEventListener('animationend', () => {
        span.remove()
        if (!el.querySelector('.ripple-ink')) {
          if (el.dataset.ripplePrevOverflow !== undefined) {
            el.style.overflow = el.dataset.ripplePrevOverflow
            delete el.dataset.ripplePrevOverflow
          }
        }
      })
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  return null
}
