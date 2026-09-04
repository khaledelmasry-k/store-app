import { FunctionalComponent } from 'preact'
import { useEffect } from 'preact/hooks'
import { useAuth } from '../../hooks/useAuth'
import { useStore } from '../../hooks/useStore'
import { MerchantStatusBar } from '../subscription/MerchantStatusBar'
import { AdminShell } from './AdminShell'
import './MerchantShell.css'
import { MerchantOnboardingTour } from '../../../merchant/components/MerchantOnboardingTour'

/** Merchant chrome owner. Pages mounted below this component render content only. */
export const MerchantShell: FunctionalComponent = ({ children }) => {
  const { user } = useAuth()
  const { store, setStoreId } = useStore()

  useEffect(() => {
    if (!user || store?.id || !user.storeIds?.length) return
    setStoreId(user.storeIds[0])
  }, [user?.uid, user?.storeIds, store?.id, setStoreId])

  return (
    <div className="merchant-shell">
      <AdminShell
        role="merchant"
        brand={store?.name || 'متجري'}
        brandLogo={store?.logo}
        storefrontHref={store ? `/store/${store.slug}${store.published ? '' : '?preview=1'}` : undefined}
        storeSwitcher={{ storeIds: user?.role === 'merchant' ? (user.storeIds || []) : [], currentId: store?.id || '', onSwitch: setStoreId }}
      >
        {user?.role === 'merchant' && <MerchantStatusBar />}
        {children}
      </AdminShell>
      {user?.role === 'merchant' && <MerchantOnboardingTour />}
    </div>
  )
}
