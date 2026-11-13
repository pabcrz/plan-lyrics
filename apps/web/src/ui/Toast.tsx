import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

/** Aviso breve que confirma una acción y permite deshacerla. Se descarta solo tras `duration` ms. */
export function Toast({
  message,
  undoLabel = 'Deshacer',
  onUndo,
  onDismiss,
  duration = 6000,
}: {
  message: string
  undoLabel?: string
  onUndo?: () => void
  onDismiss: () => void
  duration?: number
}) {
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss
  useEffect(() => {
    const timer = setTimeout(() => dismiss.current(), duration)
    return () => clearTimeout(timer)
  }, [duration])

  return (
    <div
      role="status"
      className="flex min-h-[52px] items-center gap-3 rounded-md bg-text py-0 pr-2 pl-4 text-[0.9375rem] text-bg shadow-3 [:root[data-mode=dark]_&]:bg-surface-2 [:root[data-mode=dark]_&]:text-text"
    >
      <Icon name="check" />
      <span className="flex-1">{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={() => {
            onUndo()
            onDismiss()
          }}
          className="min-h-touch cursor-pointer rounded-sm border-0 bg-transparent px-3 font-semibold text-a-300 [:root[data-mode=dark]_&]:text-accent-soft-text"
        >
          {undoLabel}
        </button>
      )}
    </div>
  )
}
