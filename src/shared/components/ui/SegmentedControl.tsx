import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'

interface Props {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

export const SegmentedControl: FunctionalComponent<Props> = ({ options, value, onChange }) => (
  <div className="segmented">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className={clsx('segment', value === o.value && 'segment-active')}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
)
