import { FunctionalComponent } from 'preact'
import { Icon } from './Icon'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export const Search: FunctionalComponent<Props> = ({ value, onChange, placeholder = 'بحث...' }) => (
  <div className="search-box">
    <Icon name="search" className="search-icon" />
    <input
      className="input"
      value={value}
      placeholder={placeholder}
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
    />
    {value && (
      <button className="search-clear" onClick={() => onChange('')} type="button">
        <Icon name="close" />
      </button>
    )}
  </div>
)
