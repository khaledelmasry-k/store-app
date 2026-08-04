import { FunctionalComponent } from 'preact'
import { clsx } from '../../utils/clsx'

interface Tab {
  key: string
  label: string
  count?: number
}

interface Props {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}

export const Tabs: FunctionalComponent<Props> = ({ tabs, active, onChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map((t) => (
      <button
        key={t.key}
        type="button"
        role="tab"
        className={clsx('tab', active === t.key && 'tab-active')}
        onClick={() => onChange(t.key)}
      >
        {t.label}
        {t.count !== undefined && <span className="tab-count">{t.count}</span>}
      </button>
    ))}
  </div>
)
