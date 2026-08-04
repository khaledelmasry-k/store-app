import { FunctionalComponent } from 'preact'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export const Search: FunctionalComponent<Props> = ({ value, onChange, placeholder = 'بحث...' }) => (
  <div className="search-box">
    <span className="material-symbols-outlined search-icon">search</span>
    <input
      className="input"
      value={value}
      placeholder={placeholder}
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
    />
    {value && (
      <button className="search-clear" onClick={() => onChange('')} type="button">
        <span className="material-symbols-outlined">close</span>
      </button>
    )}
  </div>
)
