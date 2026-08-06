import { FunctionalComponent } from 'preact'
import { Breadcrumb } from '../../shared/components/ui/Breadcrumb'
import { OrderDetails } from '../../shared/components/order/OrderDetails'

interface Props {
  id: string
}

export const PlatformOrderDetails: FunctionalComponent<Props> = ({ id }) => (
  <div>
    <Breadcrumb items={[{ label: 'الطلبات', href: '/platform/orders' }, { label: `طلب ${id.slice(0, 8)}` }]} />
    <OrderDetails id={id} />
  </div>
)
export default PlatformOrderDetails
