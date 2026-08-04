import { FunctionalComponent } from 'preact'
import { Card } from './Card'

interface Props {
  title: string
  subtitle?: string
  children?: any
}

export const ChartCard: FunctionalComponent<Props> = ({ title, subtitle, children }) => (
  <Card title={title} subtitle={subtitle}>
    <div className="chart-wrap">{children}</div>
  </Card>
)
