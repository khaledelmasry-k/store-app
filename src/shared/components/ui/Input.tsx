import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'

interface Props {
  label?: string
  error?: string
  hint?: string
  type?: string
  min?: number | string
  step?: number | string
  placeholder?: string
  value?: string | number
  onChange?: (value: string) => void
  name?: string
  disabled?: boolean
  required?: boolean
  autoComplete?: string
}

export const Input: FunctionalComponent<Props> = ({
  label,
  error,
  hint,
  type = 'text',
  min,
  step,
  placeholder,
  value,
  onChange,
  name,
  disabled,
  required,
  autoComplete,
}) => (
  <label className="field">
    {label && <span className="field-label">{label}</span>}
    <input
      type={type}
      min={min}
      step={step}
      className={clsx('input', error && 'input-error')}
      placeholder={placeholder}
      value={value}
      name={name}
      disabled={disabled}
      required={required}
      autoComplete={autoComplete}
      onInput={(e) => onChange?.((e.target as HTMLInputElement).value)}
    />
    {hint && !error && <span className="field-hint">{hint}</span>}
    {error && <span className="field-error">{error}</span>}
  </label>
)
