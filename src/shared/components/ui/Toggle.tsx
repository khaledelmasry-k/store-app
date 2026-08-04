import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'

interface Props {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
  disabled?: boolean
}

export const Toggle: FunctionalComponent<Props> = ({ checked, onChange, label, disabled }) => (
  <label className={clsx('toggle', disabled && 'toggle-disabled')}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
    />
    <span className="toggle-track">
      <span className="toggle-thumb" />
    </span>
    {label && <span className="toggle-label">{label}</span>}
  </label>
)
