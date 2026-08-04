import { listDocs, getDocById, createDoc, updateDocById } from '../utils/firestore'
import type { Store } from '../types'

const PATH = 'stores'

export const storesService = {
  list: () => listDocs<Store>(PATH, { orderBy: { field: 'createdAt' } }),
  byMerchant: (ownerId: string) => listDocs<Store>(PATH, { where: { ownerId: { value: ownerId } } }),
  get: (id: string) => getDocById<Store>(PATH, id),
  create: (data: Omit<Store, 'id'>) => createDoc<Store>(PATH, data),
  update: (id: string, data: Record<string, unknown>) => updateDocById(PATH, id, data),
}
