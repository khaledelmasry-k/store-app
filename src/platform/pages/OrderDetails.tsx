import { FunctionalComponent } from 'preact'
import { OrderDetails } from '../../shared/components/order/OrderDetails'

interface Props {
  id: string
}

export const PlatformOrderDetails: FunctionalComponent<Props> = ({ id }) => <OrderDetails id={id} />
export default PlatformOrderDetails
