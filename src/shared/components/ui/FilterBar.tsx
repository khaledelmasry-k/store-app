import { FunctionalComponent } from 'preact'
import { Search } from './Search'
import { SegmentedControl } from './SegmentedControl'

interface FilterBarProps {
  search?: string
  onSearch?: (v: string) => void
  searchPlaceholder?: string
  segments?: { label: string; value: string }[]
  activeSegment?: string
  onSegmentChange?: (v: string) => void
  actions?: any
}

export const FilterBar: FunctionalComponent<FilterBarProps> = ({
  search,
  onSearch,
  searchPlaceholder = 'بحث...',
  segments,
  activeSegment,
  onSegmentChange,
  actions,
}) => (
  <div className="filter-bar">
    <div className="filter-bar-left">
      {onSearch && <Search value={search} onChange={onSearch} placeholder={searchPlaceholder} />}
      {segments && segments.length > 0 && (
        <SegmentedControl
          value={activeSegment || segments[0].value}
          onChange={onSegmentChange}
          options={segments}
        />
      )}
    </div>
    {actions && <div className="filter-bar-right">{actions}</div>}
  </div>
)