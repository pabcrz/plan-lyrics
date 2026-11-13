import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

/** Posición vertical de una fila respecto del documento (no de la ventana): sigue válida mientras la página se desplaza. */
export type Rect = { top: number; height: number }

/** Mantiene la fila arrastrada dentro de la lista: no pasa por encima de la primera ni por debajo de la última. */
export function clampDelta(rows: Rect[], from: number, dy: number) {
  const last = rows.length - 1
  return Math.max(rows[0].top - rows[from].top, Math.min(rows[last].top + rows[last].height - (rows[from].top + rows[from].height), dy))
}

/**
 * Índice que toma la fila arrastrada: cuántas otras filas tienen su centro por encima del centro de la arrastrada.
 * Las filas de abajo cuentan también al empatar: al tope de la lista los centros coinciden y la última posición
 * sería inalcanzable.
 */
export function targetIndex(rows: Rect[], from: number, dy: number) {
  const center = rows[from].top + clampDelta(rows, from, dy) + rows[from].height / 2
  return rows.reduce((count, row, index) => {
    if (index === from) return count
    const middle = row.top + row.height / 2
    return (index < from ? middle < center : middle <= center) ? count + 1 : count
  }, 0)
}

/** Cuánto se aparta la fila `index` mientras se arrastra la fila `from` hacia `to`. */
export function shiftFor(from: number, to: number, index: number, height: number) {
  if (from < to && index > from && index <= to) return -height
  if (from > to && index >= to && index < from) return height
  return 0
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

type Session = { from: number; rows: Rect[]; y0: number; y: number; scroll0: number }
export type DragState = { from: number; to: number; dy: number; height: number }

const EDGE = 56
const FOOTER = 96 // el pie con «Agregar al setlist» tapa el borde inferior

/**
 * Reordenar por puntero (asa) y por teclado (flechas sobre el asa). La fila arrastrada sigue al dedo,
 * las demás se apartan y la página se desplaza sola cerca de los bordes. Escape cancela el arrastre.
 * `onMove(from, to)` se llama una sola vez, al soltar o al pulsar una flecha.
 */
export function useDragReorder({ count, rowRects, onMove }: { count: number; rowRects: () => Rect[]; onMove: (from: number, to: number) => void }) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const session = useRef<Session | null>(null)
  const moveRef = useRef(onMove)
  const rectsRef = useRef(rowRects)
  useEffect(() => {
    moveRef.current = onMove
    rectsRef.current = rowRects
  })

  const refresh = useCallback(() => {
    const active = session.current
    if (!active) return
    const dy = clampDelta(active.rows, active.from, active.y - active.y0 + (window.scrollY - active.scroll0))
    setDrag({ from: active.from, to: targetIndex(active.rows, active.from, dy), dy, height: active.rows[active.from].height })
  }, [])

  const finish = useCallback((commit: boolean) => {
    const active = session.current
    if (!active) return
    session.current = null
    const dy = clampDelta(active.rows, active.from, active.y - active.y0 + (window.scrollY - active.scroll0))
    const to = targetIndex(active.rows, active.from, dy)
    setDrag(null)
    if (commit && to !== active.from) moveRef.current(active.from, to)
  }, [])

  // Cerca del borde de la ventana la página se desplaza sola mientras se mantiene el arrastre.
  const dragging = drag !== null
  useEffect(() => {
    if (!dragging || typeof requestAnimationFrame !== 'function') return
    let frame = 0
    const tick = () => {
      const active = session.current
      if (active) {
        const bottom = window.innerHeight - FOOTER
        const speed = active.y < EDGE ? -Math.ceil((EDGE - active.y) / 6) : active.y > bottom ? Math.ceil((active.y - bottom) / 6) : 0
        if (speed) {
          window.scrollBy(0, Math.max(-14, Math.min(14, speed)))
          refresh()
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [dragging, refresh])

  useEffect(() => {
    if (!drag) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') finish(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drag, finish])

  /** Propiedades del asa de la fila `index`: puntero y teclado. */
  const gripProps = (index: number) => ({
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      try { event.currentTarget.setPointerCapture?.(event.pointerId) } catch { /* el puntero ya terminó */ }
      session.current = { from: index, rows: rectsRef.current(), y0: event.clientY, y: event.clientY, scroll0: window.scrollY }
      refresh()
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (!session.current) return
      session.current.y = event.clientY
      refresh()
    },
    onPointerUp() { finish(true) },
    onPointerCancel() { finish(false) },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      event.preventDefault()
      const to = index + (event.key === 'ArrowDown' ? 1 : -1)
      if (to >= 0 && to < count) moveRef.current(index, to)
    },
  })

  /** Estilo de la fila `index` durante el arrastre: la arrastrada sigue al puntero y las demás se apartan. */
  const rowStyle = (index: number): CSSProperties | undefined => {
    if (!drag) return undefined
    if (index === drag.from) return { transform: `translateY(${drag.dy}px)`, transition: 'none' }
    const shift = shiftFor(drag.from, drag.to, index, drag.height)
    return shift ? { transform: `translateY(${shift}px)` } : undefined
  }
  return { drag, gripProps, rowStyle }
}
