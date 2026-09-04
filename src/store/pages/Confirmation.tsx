import { FunctionalComponent } from 'preact'
import { Link } from 'wouter'
import { useStore } from '../../shared/hooks/useStore'
import { useAuth } from '../../shared/hooks/useAuth'
import { Button } from '../../shared/components/ui/Button'
import { Icon } from '../../shared/components/ui/Icon'

interface Props {
  orderNumber: string
  phone: string
}

export const StoreConfirmation: FunctionalComponent<Props> = ({ orderNumber, phone }) => {
  const { store } = useStore()
  const { user } = useAuth()
  const isGuest = !user || user.role !== 'customer'

  return (
    <div className="storefront-page storefront-confirmation">
      <div className="confirmation-container">
        <div className="confirmation-card">
          <div className="confirmation-icon">
            <Icon name="check_circle" />
          </div>
          <h1>تم إنشاء طلبك بنجاح</h1>
          <p className="confirmation-subtitle">نشكرك على ثقتك! رقم طلبك:</p>
          <p className="order-number monospace">{orderNumber}</p>
          <p className="confirmation-subtitle">يمكنك متابعة طلبك باستخدام رقم الطلب ورقم الهاتف.</p>

          {isGuest && (
            <div className="guest-signup">
              <h2>هل تريد إنشاء حساب لمتابعة جميع طلباتك بسهولة؟</h2>
              <p className="muted small">أنشئ حساباً الآن وسنربط هذا الطلب بحسابك تلقائياً — التسجيل اختياري.</p>
              <Link href={`/store/${store?.slug}/login?mode=signup&order=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`}>
                <Button icon="person_add" className="mt-1">إنشاء حساب</Button>
              </Link>
            </div>
          )}

          <div className="confirmation-actions">
            <Link href={`/store/${store?.slug}/track`}><Button variant="outline">تتبع الطلب</Button></Link>
            <Link href={`/store/${store?.slug}`}><Button>متابعة التسوق</Button></Link>
          </div>
        </div>
      </div>
    </div>
  )
}
export default StoreConfirmation