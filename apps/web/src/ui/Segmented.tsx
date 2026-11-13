import { cx } from './cx'

export type SegmentedOption<T extends string> = { value: T; label: string }

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-[3px] rounded-md bg-surface-2 p-[3px]"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cx(
            'min-h-touch cursor-pointer rounded-lg border-0 text-sm font-semibold',
            option.value === value ? 'bg-surface text-text shadow-1' : 'bg-transparent text-text-2',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
