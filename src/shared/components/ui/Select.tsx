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
  hint?: string
  name?: string
  disabled?: boolean
}

/**
 * A wrapping <label> only names the control when it actually contains text.
 * These render without a visible label all over the dashboard filters —
 * placeholder-only — and a control with no accessible name is announced as
 * nothing at all by a screen reader; axe flags it as critical. The
 * `aria-label` falls back to the placeholder, then the field name, whenever
 * there is no visible label to borrow.
 */
export const Select: FunctionalComponent<Props> = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  hint,
  name,
  disabled,
}) => (
  <label className="field">
    {label && <span className="field-label">{label}</span>}
    <select
      className={clsx('input', error && 'input-error')}
      aria-label={label ? undefined : placeholder || name}
      value={value}
      name={name}
      disabled={disabled}
      onChange={(e) => onChange?.((e.target as HTMLSelectElement).value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    {hint && <span className="field-hint">{hint}</span>}
    {error && <span className="field-error">{error}</span>}
  </label>
)
