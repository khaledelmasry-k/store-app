import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface Props {
  items: BreadcrumbItem[]
}

export const Breadcrumb: FunctionalComponent<Props> = ({ items }) => (
  <nav className="breadcrumb-nav" aria-label="التنقل">
    <ol className="breadcrumb-list">
      {items.map((item, i) => (
        <li key={i} className="breadcrumb-item">
          {i > 0 && <span className="breadcrumb-sep">/</span>}
          {item.href ? (
            <Link href={item.href} className="breadcrumb-link">{item.label}</Link>
          ) : (
            <span className="breadcrumb-current">{item.label}</span>
          )}
        </li>
      ))}
    </ol>
  </nav>
)