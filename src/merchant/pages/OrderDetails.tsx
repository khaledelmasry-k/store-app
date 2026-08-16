import { FunctionalComponent } from 'preact'
import { Breadcrumb } from '../../shared/components/ui/Breadcrumb'
import { OrderDetails } from '../../shared/components/order/OrderDetails'
import { InternalPageHeader } from '../components/InternalWorkspace'
import '../components/InternalWorkspace.css'

interface Props {
  id: string
}

export const MerchantOrderDetails: FunctionalComponent<Props> = ({ id }) => (
  <div className="merchant-operations merchant-order-details-page">
    <InternalPageHeader
      eyebrow="مساحة الطلبات"
      title={`طلب ${id.slice(0, 8)}`}
      subtitle="تفاصيل الطلب، العميل، المنتجات، الحالة والربح المصرح به"
      actions={<Breadcrumb items={[{ label: 'الطلبات', href: '/dashboard/orders' }, { label: `طلب ${id.slice(0, 8)}` }]} />}
    />
    <OrderDetails id={id} />
  </div>
)
export default MerchantOrderDetails
