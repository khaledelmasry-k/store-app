import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'

interface Option {
  value: string
  label: string
}

interface Props {
  label?: string
  value?: string
  onChange?: (value: string) => void
  options: Option[]
  placeholder?: string
  error?: string
  name?: string
  disabled?: boolean
  multiple?: boolean
}

export const Select: FunctionalComponent<Props> = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  name,
  disabled,
  multiple,
}) => (
  <label className="field">
    {label && <span className="field-label">{label}</span>}
    <select
      className={clsx('input', error && 'input-error')}
      value={value}
      name={name}
      disabled={disabled}
      multiple={multiple}
      onChange={(e) => onChange?.((e.target as HTMLSelectElement).value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    {error && <span className="field-error">{error}</span>}
  </label>
)
