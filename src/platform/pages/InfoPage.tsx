import { FunctionalComponent } from 'preact'
import { useState } from 'preact/hooks'
import { Link } from 'wouter'
import { BrandMark } from '../../shared/components/brand/BrandMark'
import { Button } from '../../shared/components/ui/Button'
import { Icon } from '../../shared/components/ui/Icon'
import { useTheme } from '../../shared/hooks/useTheme'
import './LandingPage.css'

interface Props {
  title: string
  body: string[]
}

export const InfoPage: FunctionalComponent<Props> = ({ title, body }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const theme = useTheme()

  return (
    <div className="landing landing-stitch-exact" dir="rtl">
      <header className="landing-header stitch-header">
        <div className="landing-container stitch-header-inner">
          <a href="/" className="landing-brand"><BrandMark small /><span>M&amp;K Store</span></a>
          <button type="button" className="landing-menu-toggle" aria-label="القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <nav className={`landing-nav${menuOpen ? ' open' : ''}`} aria-label="التنقل الرئيسي">
            <button type="button" className="landing-nav-btn landing-theme-toggle" aria-label="تبديل السمة" onClick={theme.toggle}>
              <Icon name={theme.theme === 'dark' ? 'light_mode' : 'dark_mode'} />
            </button>
            <Link href="/login" className="landing-nav-btn landing-nav-btn-ghost">تسجيل الدخول</Link>
            <Link href="/register" className="landing-nav-btn landing-nav-btn-primary">ابدأ الآن مجاناً</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="stitch-info-section">
          <div className="landing-container stitch-info-container">
            <span className="stitch-info-eyebrow">M&amp;K Store</span>
            <h1>{title}</h1>
            {body.map((p, i) => <p key={i}>{p}</p>)}
            <div className="stitch-info-actions">
              <Link href="/"><Button icon="arrow_forward">العودة إلى الرئيسية</Button></Link>
              <Link href="/register"><Button variant="outline" icon="rocket_launch">ابدأ متجرك الآن</Button></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="stitch-footer-band">
        <div className="landing-container stitch-footer-grid">
          <div><BrandMark small /><strong>M&amp;K Store</strong><p>منصة التجارة الإلكترونية المتكاملة.</p></div>
          <div><h3>المنصة</h3><Link href="/">الرئيسية</Link><Link href="/#pricing">الأسعار</Link></div>
          <div><h3>قانونية</h3><Link href="/terms">الشروط والأحكام</Link><Link href="/privacy">سياسة الخصوصية</Link></div>
          <div><h3>الدعم</h3><Link href="/contact">تواصل معنا</Link><Link href="/login">تسجيل الدخول</Link></div>
        </div>
        <div className="landing-container stitch-footer-copy">© {new Date().getFullYear()} M&amp;K Store. جميع الحقوق محفوظة لشركة حلول التجارة الذكية.</div>
      </footer>
    </div>
  )
}

export default InfoPage