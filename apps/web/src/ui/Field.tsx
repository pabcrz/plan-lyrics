import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'
import { Icon } from './Icon'

export type ControlProps = {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

/**
 * Etiqueta siempre visible, ayuda debajo y error con icono y texto (no solo color).
 * `children` recibe los atributos que el control debe aplicar.
 */
export function Field({
  label,
  help,
  error,
  children,
}: {
  label: ReactNode
  help?: ReactNode
  error?: ReactNode
  children: (control: ControlProps) => ReactNode
}) {
  const id = useId()
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy = [error ? errorId : null, help ? helpId : null].filter(Boolean).join(' ')
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children({
        id,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        ...(error ? { 'aria-invalid': true as const } : {}),
      })}
      {help && (
        <p id={helpId} className="m-0 text-[0.8125rem] text-text-3">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="m-0 flex items-center gap-1.5 text-[0.8125rem] font-medium text-cancel-fg">
          <Icon name="alert" width={16} height={16} />
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClass =
  'min-h-touch-lg w-full rounded-md border border-line-strong bg-surface px-3 text-base text-text placeholder:text-text-3 ' +
  'focus-visible:border-focus focus-visible:outline-offset-0 aria-invalid:border-cancel-fg'

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: ReactNode
  help?: ReactNode
  error?: ReactNode
}

export function TextField({ label, help, error, className, ...input }: TextFieldProps) {
  return (
    <Field label={label} help={help} error={error}>
      {(control) => <input {...input} {...control} className={cx(inputClass, className)} />}
    </Field>
  )
}
