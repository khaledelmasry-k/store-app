import { listDocs, getDocById, createDoc, updateDocById, deleteDocById } from '../utils/firestore'
import type { Category } from '../types'

const PATH = 'categories'

export const categoriesService = {
  list: (storeId: string) => listDocs<Category>(PATH, { storeId, orderBy: { field: 'order' } }),
  get: (id: string) => getDocById<Category>(PATH, id),
  create: (storeId: string, data: Omit<Category, 'id' | 'storeId'>) => createDoc<Category>(PATH, { ...data, storeId }),
  update: (id: string, data: Record<string, unknown>) => updateDocById(PATH, id, data),
  remove: (id: string) => deleteDocById(PATH, id),
}
