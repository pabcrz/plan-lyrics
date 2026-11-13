import { useId, type ReactNode } from 'react'
import { cx } from './cx'

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-[0.9375rem] font-semibold">
        <span id={`${id}-l`}>{label}</span>
        {description && (
          <small id={`${id}-d`} className="mt-0.5 block text-[0.8125rem] font-normal text-text-3">
            {description}
          </small>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cx(
          'relative h-8 w-[52px] flex-none cursor-pointer rounded-full border p-0 disabled:cursor-not-allowed disabled:opacity-45',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-surface-2',
          'after:absolute after:top-[3px] after:left-[3px] after:size-6 after:rounded-full after:content-[""]',
          'before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[""]', // área táctil de 44 px
          'after:transition-transform after:duration-(--t-fast)',
          checked ? 'after:translate-x-5 after:bg-on-accent' : 'after:bg-text-3',
        )}
      />
    </div>
  )
}
