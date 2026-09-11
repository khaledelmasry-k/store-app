import { FunctionalComponent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../../shared/components/ui/Icon'
import './OperatingJourney.css'

const STEPS = [
  { icon: 'storefront', labelAr: 'المتجر', labelEn: 'Store', subtitle: 'واجهة البيع', step: '01', x: 91.5, y: 50 },
  { icon: 'receipt_long', labelAr: 'الطلب', labelEn: 'Order', subtitle: 'تسجيل العملية', step: '02', x: 74.9, y: 39.5 },
  { icon: 'local_shipping', labelAr: 'الشحن', labelEn: 'Shipping', subtitle: 'التسليم والتتبع', step: '03', x: 58.3, y: 58.5 },
  { icon: 'person', labelAr: 'العميل', labelEn: 'Customer', subtitle: 'سجل العميل', step: '04', x: 41.7, y: 41.5 },
  { icon: 'hub', labelAr: 'CRM', labelEn: 'CRM', subtitle: 'المتابعة والعلاقات', step: '05', x: 25.1, y: 56 },
  { icon: 'bar_chart', labelAr: 'التقارير', labelEn: 'Reports', subtitle: 'القرار والنمو', step: '06', x: 8.5, y: 46 },
] as const

const TRAVEL_MS = 1050
const CHECKPOINT_PAUSE_MS = 700
const REPORTS_PAUSE_MS = 1550

function PremiumVan({ moving, mini = false }: { moving: boolean; mini?: boolean }) {
  return (
    <svg
      viewBox="0 0 96 44"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`oj-van-svg${mini ? ' oj-van-svg--mini' : ''}`}
    >
      <ellipse cx="49" cy="39" rx="34" ry="3" fill="#17233d" opacity="0.12" />
      <path d="M8 12.5C8 9.46 10.46 7 13.5 7H59v27H8V12.5Z" fill="currentColor" />
      <path d="M59 13h17.2c2.1 0 4.05 1.08 5.16 2.86L88 26.5V34H59V13Z" fill="currentColor" />
      <path d="M63 16h11.4c1.3 0 2.5.67 3.2 1.78L81.5 24H63v-8Z" fill="#eef2ff" />
      <path d="M80.5 24 75 16h1.2c2.1 0 4.05 1.08 5.16 2.86L85 24h-4.5Z" fill="#dbeafe" />
      <path d="M14 13h36M14 18h24" stroke="#fff" strokeOpacity="0.24" strokeWidth="2" strokeLinecap="round" />
      <path d="M59 14v20M8 29h80" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" />
      <rect x="86" y="26" width="4.5" height="4.5" rx="1.2" fill="#fde68a" />
      <rect x="6" y="25" width="3" height="5" rx="1" fill="#fca5a5" opacity="0.85" />
      <g className={`oj-wheel${moving ? ' is-spinning' : ''}`}>
        <circle cx="25" cy="34" r="7" fill="#17233d" />
        <circle cx="25" cy="34" r="3.5" fill="#f8fafc" />
        <path d="M25 31v6M22 34h6" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      <g className={`oj-wheel${moving ? ' is-spinning' : ''}`}>
        <circle cx="72" cy="34" r="7" fill="#17233d" />
        <circle cx="72" cy="34" r="3.5" fill="#f8fafc" />
        <path d="M72 31v6M69 34h6" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export const OperatingJourney: FunctionalComponent = () => {
  const sectionRef = useRef<HTMLElement>(null)
  const timerRef = useRef<number | null>(null)
  const activeRef = useRef(0)
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const setCheckpoint = (index: number) => {
    activeRef.current = index
    setActive(index)
  }

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting && entry.intersectionRatio > 0.14)
    }, { threshold: [0, 0.14, 0.35] })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (!visible || reduced) {
      setIsMoving(false)
      setIsResetting(false)
      return
    }

    let cancelled = false
    const schedule = (delay: number, callback: () => void) => {
      timerRef.current = window.setTimeout(() => {
        if (!cancelled) callback()
      }, delay)
    }

    const restAt = (index: number) => {
      setIsMoving(false)
      const pause = index === STEPS.length - 1 ? REPORTS_PAUSE_MS : CHECKPOINT_PAUSE_MS
      schedule(pause, () => {
        if (index === STEPS.length - 1) {
          setIsResetting(true)
          schedule(220, () => {
            setCheckpoint(0)
            schedule(TRAVEL_MS + 80, () => {
              setIsResetting(false)
              restAt(0)
            })
          })
          return
        }

        const next = index + 1
        setIsMoving(true)
        setCheckpoint(next)
        schedule(TRAVEL_MS, () => restAt(next))
      })
    }

    restAt(activeRef.current)
    return () => {
      cancelled = true
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [visible, reduced])

  const displayActive = reduced ? 0 : active
  const progress = reduced ? 100 : (displayActive / (STEPS.length - 1)) * 100
  const activeStep = STEPS[displayActive]

  return (
    <section
      ref={sectionRef}
      id="operating-flow"
      className={`oj-section${visible ? ' is-visible' : ''}${reduced ? ' is-reduced' : ''}${isMoving ? ' is-moving' : ''}${isResetting ? ' is-resetting' : ''}`}
      aria-labelledby="oj-title"
      data-active-step={reduced ? 'reduced' : activeStep.labelEn.toLowerCase()}
      dir="rtl"
    >
      <div className="oj-bg" aria-hidden="true"><span className="oj-bg-grid" /><span className="oj-bg-glow" /></div>
      <div className="oj-container">
        <div className="oj-header">
          <span className="oj-eyebrow">دورة التشغيل</span>
          <h2 id="oj-title">من المنتج إلى الربحية، في مسار واحد</h2>
          <p>منتج → بيع → طلب → عميل → شحن → متابعة → ربحية. كل خطوة تسلّم بياناتها للخطوة التالية داخل Matjari.</p>
        </div>

        <div className="oj-stage" role="group" aria-label="رحلة التشغيل من المتجر إلى التقارير">
          <div className="oj-route" aria-hidden="true">
            <svg viewBox="0 0 1000 96" preserveAspectRatio="none" className="oj-route-svg">
              <defs>
                <linearGradient id="oj-route-gradient" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="58%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              <path className="oj-route-base" d="M915 48 C860 48 805 36 749 38 S638 58 583 56 S472 38 417 40 S306 56 251 54 S140 44 85 44" pathLength="100" />
              <path className="oj-route-progress" d="M915 48 C860 48 805 36 749 38 S638 58 583 56 S472 38 417 40 S306 56 251 54 S140 44 85 44" pathLength="100" style={{ strokeDasharray: `${progress} 100` }} />
            </svg>
            <div className="oj-nodes">
              {STEPS.map((step, index) => {
                const state = reduced ? 'is-complete' : index < displayActive ? 'is-done' : index === displayActive ? 'is-active' : ''
                return <span key={step.labelEn} className={`oj-node ${state}`} style={{ left: `${step.x}%`, top: `${step.y}%` }}><i /></span>
              })}
            </div>
            {!reduced && (
              <div className="oj-commerce-token" style={{ left: `${activeStep.x}%`, top: `${activeStep.y}%` }}>
                <span key={activeStep.labelEn} className={`oj-token-visual${displayActive === 2 ? ' is-shipping' : ''}`}>
                  {displayActive === 2 ? <PremiumVan moving={isMoving} /> : <Icon name={activeStep.icon} />}
                </span>
              </div>
            )}
          </div>

          {!reduced && (
            <div className="oj-mobile-token" aria-hidden="true" style={{ top: `${46 + displayActive * 104}px` }}>
              <Icon name={activeStep.icon} />
            </div>
          )}

          <ol className="oj-cards">
            {STEPS.map((step, index) => {
              const isActive = !reduced && index === displayActive
              const isDone = !reduced && index < displayActive
              return (
                <li
                  key={step.labelEn}
                  className={`oj-card${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                  data-step={step.labelEn.toLowerCase()}
                >
                  <span className="oj-card-step">{step.step}</span>
                  <span className="oj-card-node" aria-hidden="true" />
                  <span className="oj-card-icon"><Icon name={step.icon} /></span>
                  <span className="oj-card-copy">
                    <small className="oj-card-en">{step.labelEn}</small>
                    <strong className="oj-card-label">{step.labelAr}</strong>
                    <span className="oj-card-subtitle">{step.subtitle}</span>
                  </span>
                  {isDone && <span className="oj-card-check" aria-hidden="true"><Icon name="check" /></span>}
                  {index === 2 && isActive && <span className="oj-card-shipping-van" aria-hidden="true"><PremiumVan moving={isMoving} mini /></span>}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

export default OperatingJourney
