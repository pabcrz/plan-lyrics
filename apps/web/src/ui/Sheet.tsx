import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Hoja inferior modal: foco atrapado, y se cierra con Escape, tocando fuera, tocando la barrita de arriba o
 * arrastrándola hacia abajo; el foco vuelve al elemento que la abrió.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const titleId = useId()
  const [drag, setDrag] = useState(0)
  const gesture = useRef<{ from: number; moved: boolean } | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const node = panel.current!
    const first = node.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? node).focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const firstItem = items[0]!
      const lastItem = items[items.length - 1]!
      const active = document.activeElement
      if (event.shiftKey && (active === firstItem || !node.contains(active))) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && (active === lastItem || !node.contains(active))) {
        event.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-none md:items-center bg-[oklch(0_0_0/0.42)]"
      // `pointerdown` y no `mousedown`: en pantallas táctiles el segundo no llega a un fondo que no es un botón.
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={drag > 0 ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        className="max-h-[90dvh] w-full max-w-[480px] overflow-y-auto overscroll-contain rounded-t-[20px] md:rounded-[20px] bg-surface px-4 pt-0 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-3 outline-none transition-transform duration-(--t-base) motion-reduce:transition-none"
      >
        {/* La barrita es un control: tocarla cierra la hoja y arrastrarla hacia abajo también (sin foco: Escape ya cubre el teclado). */}
        <div
          role="button"
          tabIndex={-1}
          aria-label="Cerrar hoja"
          className="mx-auto flex h-8 w-24 cursor-grab touch-none items-center justify-center"
          onPointerDown={(event) => { gesture.current = { from: event.clientY, moved: false }; event.currentTarget.setPointerCapture?.(event.pointerId) }}
          onPointerMove={(event) => {
            if (!gesture.current) return
            const dy = Math.max(0, event.clientY - gesture.current.from)
            if (dy > 6) gesture.current.moved = true
            setDrag(dy)
          }}
          onPointerUp={() => {
            const moved = gesture.current?.moved ?? false
            const dy = drag
            gesture.current = moved ? { from: 0, moved: true } : null
            setDrag(0)
            if (moved && dy > 90) onClose()
          }}
          onClick={() => { if (gesture.current?.moved) { gesture.current = null; return } onClose() }}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClose() } }}
        >
          <span aria-hidden="true" className="h-1 w-9 rounded bg-line-strong" />
        </div>
        <h2 id={titleId} className="mb-3 font-display text-xl leading-tight font-bold tracking-tight">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}
