import { FunctionalComponent } from 'preact'
import { OrderDetails } from '../../shared/components/order/OrderDetails'

interface Props {
  id: string
}

export const MerchantOrderDetails: FunctionalComponent<Props> = ({ id }) => <OrderDetails id={id} />
export default MerchantOrderDetails
