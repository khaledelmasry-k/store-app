import { listDocs, getDocById, createDoc, updateDocById, deleteDocById } from '../utils/firestore'
import type { Customer } from '../types'

const PATH = 'customers'

export const customersService = {
  list: (storeId: string) =>
    listDocs<Customer>(PATH, { storeId, orderBy: { field: 'createdAt' } }),
  get: (id: string) => getDocById<Customer>(PATH, id),
  create: (storeId: string, data: Omit<Customer, 'id' | 'storeId'>) => createDoc<Customer>(PATH, { ...data, storeId }),
  update: (id: string, data: Record<string, unknown>) => updateDocById(PATH, id, data),
  remove: (id: string) => deleteDocById(PATH, id),
}
