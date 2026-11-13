import type { ReactNode } from 'react'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

export function Notice({
  title,
  tone = 'info',
  icon = 'info',
  role,
  children,
}: {
  title?: ReactNode
  tone?: 'info' | 'warn'
  icon?: IconName
  /** `alert` solo para errores que aparecen tras una acción. */
  role?: 'status' | 'alert'
  children?: ReactNode
}) {
  return (
    <div
      role={role}
      className={cx(
        'flex gap-3 rounded-md px-4 py-3 text-sm leading-snug',
        tone === 'info' ? 'bg-accent-soft text-accent-soft-text' : 'border border-line-strong bg-draft-bg text-text',
      )}
    >
      <Icon name={icon} className="mt-0.5" />
      <div>
        {title && <b className="block text-[0.9375rem]">{title}</b>}
        {children}
      </div>
    </div>
  )
}
