import { FunctionalComponent } from 'preact'
import type { QuantityTier } from '../../shared/types'
import { Input } from '../../shared/components/ui/Input'
import { Button } from '../../shared/components/ui/Button'
import { Icon } from '../../shared/components/ui/Icon'
import { formatCurrency } from '../../shared/utils/format'

interface Props {
  tiers: QuantityTier[]
  onChange: (tiers: QuantityTier[]) => void
}

export const QuantityTiersEditor: FunctionalComponent<Props> = ({ tiers, onChange }) => {
  const update = (index: number, patch: Partial<QuantityTier>) => {
    const next = tiers.map((t, i) => (i === index ? { ...t, ...patch } : t))
    onChange(next)
  }

  const add = () => {
    const maxMin = tiers.reduce((m, t) => Math.max(m, t.minQuantity || 0), 0)
    onChange([...tiers, { minQuantity: maxMin + 1, maxQuantity: null, price: 0 }])
  }

  const remove = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index))
  }

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir
    if (to < 0 || to >= tiers.length) return
    const next = [...tiers]
    ;[next[from], next[to]] = [next[to], next[from]]
    onChange(next)
  }

  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity)

  return (
    <div className="qty-tier-editor mt-1">
      <div className="field">
        <span className="field-label">السعر حسب الكمية</span>
      </div>
      <div className="qty-tier-editor-list">
        {tiers.map((t, i) => (
          <div key={i} className="qty-tier-editor-row">
            <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title="تحريك لأعلى">
              <Icon name="arrow_upward" />
            </button>
            <button type="button" className="icon-btn" disabled={i === tiers.length - 1} onClick={() => move(i, 1)} title="تحريك لأسفل">
              <Icon name="arrow_downward" />
            </button>
            <Input label="من الكمية" type="number" value={t.minQuantity || ''} onChange={(v) => update(i, { minQuantity: Math.max(1, Number(v) || 1) })} />
            <Input label="إلى الكمية (فارغ = وما فوق)" type="number" value={t.maxQuantity ?? ''} onChange={(v) => update(i, { maxQuantity: v === '' ? null : Number(v) })} />
            <Input label="السعر للقطعة" type="number" value={t.price || ''} onChange={(v) => update(i, { price: Number(v) })} />
            <button type="button" className="icon-btn icon-btn-danger" onClick={() => remove(i)} title="حذف المستوى">
              <Icon name="delete" />
            </button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" icon="add" onClick={add}>إضافة مستوى سعري</Button>
      {sorted.length > 0 && (
        <div className="qty-tier-editor-summary muted small mt-1">
          <div className="field-label">معاينة للعميل</div>
          {sorted.map((t) => (
            <div key={t.minQuantity} className="summary-row">
              <span>
                {t.minQuantity} {t.minQuantity === 1 ? 'قطعة' : t.minQuantity === 2 ? 'قطعتان' : t.minQuantity <= 10 ? 'قطع' : 'قطعة'}
                {t.maxQuantity != null ? ` – ${t.maxQuantity}` : '+'}
              </span>
              <span>{formatCurrency(t.price || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
