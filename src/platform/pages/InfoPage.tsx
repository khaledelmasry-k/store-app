import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { Button } from '../../shared/components/ui/Button'
import { Icon } from '../../shared/components/ui/Icon'

interface Props {
  title: string
  body: string[]
}

export const InfoPage: FunctionalComponent<Props> = ({ title, body }) => (
  <div className="landing" dir="rtl">
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <Link href="/" className="landing-brand">
          <span className="landing-logo"><Icon name="storefront" /></span>
          <span>M&amp;K Store</span>
        </Link>
        <nav className="landing-nav">
          <Link href="/login" className="landing-nav-btn landing-nav-btn-ghost">تسجيل الدخول</Link>
          <Link href="/register" className="landing-nav-btn landing-nav-btn-primary">ابدأ مجانًا</Link>
        </nav>
      </div>
    </header>
    <main className="landing-main">
      <section className="landing-hero">
        <div className="landing-container" style={{ maxWidth: 720 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>{title}</h1>
          {body.map((p, i) => (
            <p key={i} style={{ color: '#64748b', lineHeight: 2, marginBottom: '0.9rem' }}>{p}</p>
          ))}
          <div className="hero-actions" style={{ marginTop: '2rem' }}>
            <Link href="/"><Button icon="arrow_forward">العودة إلى الرئيسية</Button></Link>
            <Link href="/register"><Button variant="outline" icon="rocket_launch">ابدأ متجرك الآن</Button></Link>
          </div>
        </div>
      </section>
    </main>
    <footer className="landing-footer">
      <div className="landing-container">
        <p className="footer-copy" style={{ borderTop: 'none', paddingTop: 0 }}>
          © {new Date().getFullYear()} M&amp;K Store. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  </div>
)

export default InfoPage
