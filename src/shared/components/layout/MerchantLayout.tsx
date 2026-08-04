import { FunctionalComponent } from 'preact'
import { useEffect } from 'preact/hooks'
import { useAuth } from '../../hooks/useAuth'
import { useStore } from '../../hooks/useStore'
import { AppShell } from './AppShell'

export const MerchantLayout: FunctionalComponent = ({ children }) => {
  const { user } = useAuth()
  const { store, setStoreId } = useStore()

  useEffect(() => {
    if (!user) return
    if (store?.id) return
    // Both merchants AND staff members have tenant storeIds; staff must also
    // resolve a storeId or every store-scoped query runs against an empty id.
    if (user.storeIds && user.storeIds.length > 0) {
      setStoreId(user.storeIds[0])
    }
  }, [user?.uid, store?.id])

  const brand = store?.name || 'متجري'
  return (
    <AppShell
      navKey="dashboard"
      brand={brand}
      storefrontHref={store ? `/store/${store.slug}` : undefined}
      storeSwitcher={{ storeIds: user?.role === 'merchant' ? (user.storeIds || []) : [], currentId: store?.id || '', onSwitch: setStoreId }}
    >
      {children}
    </AppShell>
  )
}
