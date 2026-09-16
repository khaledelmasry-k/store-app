import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { submitShippingPartnerApplicationCallable } from '../../shared/services/auth'
import { BrandLogo } from '../../shared/components/brand/BrandLogo'
import { Icon } from '../../shared/components/ui/Icon'
import { useTheme } from '../../shared/hooks/useTheme'
import './LandingPage.css'
import './ShippingPartnerApply.css'

export const ShippingPartnerApply: FunctionalComponent = () => {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const theme = useTheme()

  const submit = async (event: Event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = event.currentTarget as HTMLFormElement
    const data = Object.fromEntries(new FormData(form).entries())
    try {
      await submitShippingPartnerApplicationCallable({
        ...data,
        hasApi: data.hasApi === 'on',
        supportsCOD: data.supportsCOD === 'on',
        supportsTracking: data.supportsTracking === 'on',
        supportsPickup: data.supportsPickup === 'on',
        supportsReturns: data.supportsReturns === 'on',
        consent: data.consent === 'on',
      })
      setSent(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: any) {
      setError(e?.message || 'تعذر إرسال الطلب، حاول مرة أخرى')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="landing shipping-apply-page" dir="rtl">
      <header className="landing-header stitch-header">
        <div className="landing-container stitch-header-inner">
          <a href="/" className="landing-brand" aria-label="متجري — الرئيسية">
            <BrandLogo className="landing-primary-logo" />
          </a>
          <button
            type="button"
            className="landing-menu-toggle"
            aria-label="القائمة"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <nav className={`landing-nav${menuOpen ? ' open' : ''}`} aria-label="التنقل الرئيسي">
            <button type="button" className="landing-nav-btn landing-theme-toggle" aria-label="تبديل السمة" onClick={theme.toggle}>
              <Icon name={theme.theme === 'dark' ? 'light_mode' : 'dark_mode'} />
            </button>
            <Link href="/login" className="landing-nav-btn landing-nav-btn-ghost">تسجيل الدخول</Link>
            <Link href="/register" className="landing-nav-btn landing-nav-btn-primary">ابدأ الآن</Link>
          </nav>
        </div>
      </header>

      <main className="shipping-apply-shell">
        <div className="shipping-apply-panel">
          <span className="shipping-apply-eyebrow">شراكات الشحن — متجري</span>
          <h1 className="shipping-apply-title">انضم كشريك شحن</h1>
          <p className="shipping-apply-subtitle">
            قدّم طلب الشراكة لربط خدمات التوصيل الخاصة بك بمنصة متجري. نراجع الطلبات خلال أيام العمل ونتواصل معك مباشرة بعد الاعتماد.
          </p>
          <div className="shipping-apply-notice">
            <Icon name="shield" ariaHidden />
            <span>شارك بيانات شركتك الأساسية فقط. لا تُرسل أي مفاتيح أو كلمات مرور أو أسرار تكامل — سيتم إعداد قنوات الربط الآمنة بعد المراجعة.</span>
          </div>

          {sent ? (
            <div className="shipping-apply-success" role="status" aria-live="polite">
              <div className="shipping-apply-success-icon" aria-hidden>
                <Icon name="check_circle" />
              </div>
              <h2>تم استلام طلب الشراكة بنجاح</h2>
              <p>شكراً لاهتمامك بالانضمام إلى شبكة شركاء الشحن. فريق متجري سيراجع بياناتك ويتواصل معك على البريد أو الهاتف المسجل خلال فترة قصيرة.</p>
              <div className="shipping-apply-alert shipping-apply-alert--success">
                <Icon name="info" ariaHidden />
                <span>يمكنك الآن متابعة تصفح المنصة. لا حاجة لإعادة إرسال الطلب إلا في حال طُلب منك تحديث البيانات.</span>
              </div>
              <div className="shipping-apply-success-actions">
                <Link href="/" className="btn btn-primary">
                  <Icon name="storefront" /> العودة للصفحة الرئيسية
                </Link>
                <Link href="/#shipping-partners" className="btn btn-outline">استعراض شركاء الشحن</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="shipping-apply-form">
              {/* ── SECTION 1 — Company Information ── */}
              <section className="shipping-apply-section" aria-labelledby="shipping-apply-company-heading">
                <div className="shipping-apply-section-head">
                  <h2 id="shipping-apply-company-heading" className="shipping-apply-section-title">
                    <Icon name="storefront" ariaHidden /> معلومات الشركة
                  </h2>
                  <p className="shipping-apply-section-desc">البيانات الأساسية للتواصل والتحقق. الحقول المميزة بـ * إلزامية.</p>
                </div>

                <div className="shipping-apply-grid">
                  <label className="shipping-apply-field">
                    <span className="shipping-apply-label">
                      اسم الشركة <span className="required" aria-hidden>*</span>
                    </span>
                    <input name="companyName" required autoComplete="organization" placeholder="مثال: شركة البراق للشحن" className="shipping-apply-input" />
                  </label>

                  <label className="shipping-apply-field">
                    <span className="shipping-apply-label">
                      الاسم القانوني <span className="optional">(اختياري)</span>
                    </span>
                    <input name="legalName" autoComplete="organization" placeholder="الاسم المسجل في السجل التجاري" className="shipping-apply-input" />
                  </label>

                  <label className="shipping-apply-field">
                    <span className="shipping-apply-label">
                      اسم جهة الاتصال <span className="required" aria-hidden>*</span>
                    </span>
                    <input name="contactName" required autoComplete="name" placeholder="الاسم الكامل للمسؤول" className="shipping-apply-input" />
                  </label>

                  <label className="shipping-apply-field">
                    <span className="shipping-apply-label">
                      المسمى الوظيفي <span className="optional">(اختياري)</span>
                    </span>
                    <input name="jobTitle" autoComplete="organization-title" placeholder="مثال: مدير العمليات" className="shipping-apply-input" />
                  </label>

                  <label className="shipping-apply-field">
                    <span className="shipping-apply-label">
                      البريد الإلكتروني <span className="required" aria-hidden>*</span>
                    </span>
                    <input
                      name="businessEmail"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="name@company.com"
                      dir="ltr"
                      className="shipping-apply-input shipping-apply-input--ltr"
                    />
                    <span className="shipping-apply-hint">يُستخدم للتواصل الرسمي بعد المراجعة</span>
                  </label>

                  <label className="shipping-apply-field">
                    <span className="shipping-apply-label">
                      الهاتف <span className="required" aria-hidden>*</span>
                    </span>
                    <input name="phone" required type="tel" autoComplete="tel" inputMode="tel" placeholder="01xxxxxxxxx" dir="ltr" className="shipping-apply-input shipping-apply-input--ltr" />
                  </label>

                  <label className="shipping-apply-field">
                    <span className="shipping-apply-label">
                      الموقع الإلكتروني <span className="optional">(اختياري)</span>
                    </span>
                    <input
                      name="websiteUrl"
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      placeholder="https://example.com"
                      dir="ltr"
                      className="shipping-apply-input shipping-apply-input--ltr"
                    />
                  </label>

                  <label className="shipping-apply-field">
                    <span className="shipping-apply-label">نطاق التغطية</span>
                    <input name="coverageNotes" placeholder="مثال: جميع المحافظات — أو: القاهرة، الجيزة، الإسكندرية" className="shipping-apply-input" />
                    <span className="shipping-apply-hint">اذكر المحافظات/المناطق التي تغطيها</span>
                  </label>
                </div>
              </section>

              {/* ── SECTION 2 — Operational Capabilities ── */}
              <section className="shipping-apply-section" aria-labelledby="shipping-apply-capabilities-heading">
                <div className="shipping-apply-section-head">
                  <h2 id="shipping-apply-capabilities-heading" className="shipping-apply-section-title">
                    <Icon name="local_shipping" ariaHidden /> القدرات التشغيلية
                  </h2>
                  <p className="shipping-apply-section-desc">حدّد الخدمات التي تقدمها حالياً. يمكنك تحديثها لاحقاً بعد الاعتماد.</p>
                </div>

                <div className="shipping-apply-capabilities" role="group" aria-labelledby="shipping-apply-capabilities-heading">
                  <label className="shipping-apply-capability">
                    <input type="checkbox" name="hasApi" />
                    <span className="shipping-apply-capability-text">
                      <strong>لدينا تكامل API</strong>
                      <span>واجهة برمجية جاهزة للربط الآلي</span>
                    </span>
                  </label>

                  <label className="shipping-apply-capability">
                    <input type="checkbox" name="supportsCOD" />
                    <span className="shipping-apply-capability-text">
                      <strong>الدفع عند الاستلام</strong>
                      <span>COD متاح للتجار والعملاء</span>
                    </span>
                  </label>

                  <label className="shipping-apply-capability">
                    <input type="checkbox" name="supportsPickup" />
                    <span className="shipping-apply-capability-text">
                      <strong>الاستلام من التاجر</strong>
                      <span>سحب الشحنات من موقع التاجر</span>
                    </span>
                  </label>

                  <label className="shipping-apply-capability">
                    <input type="checkbox" name="supportsTracking" />
                    <span className="shipping-apply-capability-text">
                      <strong>التتبع</strong>
                      <span>تتبع مباشر لحالة الشحنة</span>
                    </span>
                  </label>

                  <label className="shipping-apply-capability">
                    <input type="checkbox" name="supportsReturns" />
                    <span className="shipping-apply-capability-text">
                      <strong>الإرجاع / المرتجعات</strong>
                      <span>إدارة المرتجعات وطلبات الإرجاع</span>
                    </span>
                  </label>
                </div>
              </section>

              {/* ── SECTION 3 — Additional Details ── */}
              <section className="shipping-apply-section" aria-labelledby="shipping-apply-message-heading">
                <div className="shipping-apply-section-head">
                  <h2 id="shipping-apply-message-heading" className="shipping-apply-section-title">
                    <Icon name="chat" ariaHidden /> تفاصيل إضافية
                  </h2>
                  <p className="shipping-apply-section-desc">شارك أي معلومات تساعد فريق المراجعة على فهم خدماتكم بشكل أوضح.</p>
                </div>

                <label className="shipping-apply-field shipping-apply-field--full">
                  <span className="shipping-apply-label">
                    رسالة إضافية <span className="optional">(اختياري)</span>
                  </span>
                  <textarea
                    name="message"
                    rows={5}
                    placeholder="مثال: متوسط زمن التوصيل، حجم الأسطول، نقاط القوة، أو ملاحظات تود إضافتها..."
                    className="shipping-apply-input"
                  />
                </label>
              </section>

              {/* ── SECTION 4 — Consent ── */}
              <section className="shipping-apply-section" aria-labelledby="shipping-apply-consent-heading">
                <h2 id="shipping-apply-consent-heading" className="visually-hidden">الموافقة</h2>
                <label className="shipping-apply-consent">
                  <input type="checkbox" name="consent" required aria-required="true" />
                  <span className="shipping-apply-consent-text">
                    أوافق على التواصل بشأن طلب الشراكة <span className="required" aria-hidden>*</span>
                    <span className="shipping-apply-consent-note">بإرسال الطلب، أوافق على أن يتواصل فريق متجري معي عبر البريد والهاتف لمراجعة الشراكة وإتمام الربط.</span>
                  </span>
                </label>
              </section>

              {error && (
                <div className="shipping-apply-alert shipping-apply-alert--error" role="alert" aria-live="assertive">
                  <Icon name="error" ariaHidden />
                  <span>{error}</span>
                </div>
              )}

              {/* ── SECTION 5 — CTA ── */}
              <div className="shipping-apply-cta-wrap">
                <button type="submit" disabled={busy} className="shipping-apply-cta" aria-busy={busy}>
                  {busy ? (
                    <>
                      <span className="shipping-apply-cta-spinner" aria-hidden />
                      <span>جارٍ الإرسال…</span>
                    </>
                  ) : (
                    <>
                      <span>إرسال طلب الشراكة</span>
                      <Icon name="arrow_back" ariaHidden />
                    </>
                  )}
                </button>
                <span className="shipping-apply-cta-hint">المراجعة تستغرق عادةً 2–3 أيام عمل. سنخطرك فور اتخاذ القرار.</span>
              </div>
            </form>
          )}
        </div>
      </main>

      <footer className="stitch-footer-band">
        <div className="landing-container stitch-footer-grid">
          <div>
            <BrandLogo className="landing-footer-logo" />
            <p>منصة التجارة الإلكترونية المتكاملة.</p>
          </div>
          <div>
            <h3>المنصة</h3>
            <Link href="/">الرئيسية</Link>
            <Link href="/#pricing">الأسعار</Link>
          </div>
          <div>
            <h3>قانونية</h3>
            <Link href="/terms">الشروط والأحكام</Link>
            <Link href="/privacy">سياسة الخصوصية</Link>
          </div>
          <div>
            <h3>الدعم</h3>
            <Link href="/contact">تواصل معنا</Link>
            <Link href="/login">تسجيل الدخول</Link>
          </div>
        </div>
        <div className="landing-container stitch-footer-copy">© {new Date().getFullYear()} Matjari — متجري. جميع الحقوق محفوظة.</div>
      </footer>
    </div>
  )
}

export default ShippingPartnerApply
