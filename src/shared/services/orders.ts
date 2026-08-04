import { listDocs, getDocById, createDoc, updateDocById, deleteDocById } from '../utils/firestore'
import type { Order } from '../types'

const PATH = 'orders'

export const ordersService = {
  list: (storeId: string) =>
    listDocs<Order>(PATH, { storeId, orderBy: { field: 'createdAt' } }),
  byStatus: (storeId: string, status: string) =>
    listDocs<Order>(PATH, {
      storeId,
      where: { status: { value: status } },
      orderBy: { field: 'createdAt' },
    }),
  get: (id: string) => getDocById<Order>(PATH, id),
  create: (storeId: string, data: Omit<Order, 'id'>) => createDoc<Order>(PATH, data),
  update: (id: string, data: Record<string, unknown>) => updateDocById(PATH, id, data),
  remove: (id: string) => deleteDocById(PATH, id),
}
