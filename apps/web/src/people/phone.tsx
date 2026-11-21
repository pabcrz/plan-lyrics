import { Field, inputClass, type ControlProps } from '../ui'

/** Teléfono guardado (+52XXXXXXXXXX) → los 10 dígitos que se editan; un valor anterior sin ese formato se muestra tal cual para corregirlo. */
export const phoneDigits = (stored: string | null) => {
  const digits = (stored ?? '').replace(/\D/g, '')
  return digits.length === 12 && digits.startsWith('52') ? digits.slice(2) : digits
}
export const phoneStored = (digits: string) => (digits ? `+52${digits}` : null)
/** Vacío (sin teléfono) o exactamente 10 dígitos. */
export const phoneError = (digits: string) => (digits === '' || /^\d{10}$/.test(digits) ? '' : 'Escribe los 10 dígitos del teléfono.')

/** El +52 va fijo; solo se escriben los 10 dígitos. */
export function PhoneField({ value, error, onChange }: { value: string; error?: string; onChange: (digits: string) => void }) {
  return (
    <Field label="Teléfono (opcional)" help="Solo los 10 dígitos, sin lada de país." error={error}>
      {(control: ControlProps) => (
        <div className="flex">
          <span aria-hidden="true" className="inline-flex min-h-touch-lg items-center rounded-l-md border border-r-0 border-line-strong bg-surface-2 px-3 text-base text-text-2">+52</span>
          <input {...control} type="tel" inputMode="numeric" autoComplete="off" maxLength={10} value={value}
            onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
            className={`${inputClass} rounded-l-none`} />
        </div>
      )}
    </Field>
  )
}
