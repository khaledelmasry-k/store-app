import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'

interface Props {
  label?: string
  value?: string
  onChange?: (value: string) => void
  rows?: number
  placeholder?: string
  error?: string
  disabled?: boolean
  required?: boolean
}

export const Textarea: FunctionalComponent<Props> = ({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  error,
  disabled,
  required,
}) => (
  <label className="field">
    {label && <span className="field-label">{label}</span>}
    <textarea
      className={clsx('input', error && 'input-error')}
      value={value}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      onInput={(e) => onChange?.((e.target as HTMLTextAreaElement).value)}
    />
    {error && <span className="field-error">{error}</span>}
  </label>
)
