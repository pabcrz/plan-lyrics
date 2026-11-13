import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

type Common = {
  variant?: ButtonVariant
  block?: boolean
  /** Muestra progreso y bloquea nuevos envíos; el botón sigue enfocable. */
  loading?: boolean
  children?: ReactNode
}
type Props = Common &
  (
    | ({ icon?: false } & ButtonHTMLAttributes<HTMLButtonElement>)
    // Un botón solo con icono exige nombre accesible.
    | ({ icon: true; 'aria-label': string } & ButtonHTMLAttributes<HTMLButtonElement>)
  )

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-surface border-line-strong hover:bg-surface-2',
  quiet: 'bg-transparent text-accent hover:bg-accent-soft',
  danger: 'bg-cancel-bg text-cancel-fg border-cancel-bd',
}

export function Button({
  variant = 'primary',
  block,
  loading,
  icon,
  className,
  children,
  type = 'button',
  onClick,
  ...rest
}: Props) {
  const size =
    variant === 'quiet' || icon ? 'min-h-touch' : 'min-h-touch-lg'
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent text-[0.9375rem] font-semibold',
        'transition-[background-color,transform] duration-(--t-fast) ease-out active:translate-y-px',
        'disabled:cursor-not-allowed disabled:opacity-45',
        size,
        icon ? 'w-touch p-0' : variant === 'quiet' ? 'px-3' : 'px-6',
        block && 'w-full',
        variants[variant],
        loading && 'pointer-events-none',
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-[18px] animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  )
}
