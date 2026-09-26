import { FunctionalComponent } from 'preact'
import { useStore } from '../../shared/hooks/useStore'
import { Loading } from '../../shared/components/ui/Loading'
import { EmptyState } from '../../shared/components/ui/EmptyState'
import { Icon } from '../../shared/components/ui/Icon'
import { formatDateTime } from '../../shared/utils/format'
import { MerchantLogo } from '../../shared/components/brand/MerchantLogo'

export const StorePolicy: FunctionalComponent = () => {
  const { store } = useStore()

  if (!store) return <Loading />

  const policy = store.shipping?.refusedPolicy
  const policyEnabled = store.shipping?.refusedPolicyEnabled !== false

  if (!policyEnabled || !policy) {
    return (
      <div className="store-policy-page">
        <div className="store-policy-container">
          <header className="store-policy-header">
            <MerchantLogo store={store} variant="header" />
            <h1>سياسة الشحن والاسترجاع</h1>
          </header>
          <div className="store-policy-content">
            <EmptyState
              icon="policy"
              title="لا توجد سياسة محددة"
              description="لم يقم المتجر بإضافة سياسة شحن واسترجاع حتى الآن."
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="store-policy-page">
      <div className="store-policy-container">
        <header className="store-policy-header">
          <MerchantLogo store={store} variant="header" />
          <h1>سياسة الشحن والاسترجاع</h1>
          {store.updatedAt && (
            <p className="store-policy-updated">
              آخر تحديث: {formatDateTime(store.updatedAt)}
            </p>
          )}
        </header>
        <div className="store-policy-content">
          <div className="policy-text" dangerouslySetInnerHTML={{ __html: policy.replace(/\n/g, '<br>') }} />
        </div>
      </div>
    </div>
  )
}

export default StorePolicy