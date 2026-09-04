import { FunctionalComponent } from 'preact'
import { PageHeader } from '../../shared/components/ui/PageHeader'
import { OrderDetailsWorkspace } from '../components/OrderDetailsWorkspace'

interface Props {
  id: string
}

export const MerchantOrderDetails: FunctionalComponent<Props> = ({ id }) => (
  <div className="merchant-operations merchant-order-details-page">
    <PageHeader breadcrumb="تشغيل المتجر" title="تفاصيل الطلب" />
    <OrderDetailsWorkspace id={id} />
  </div>
)
export default MerchantOrderDetails