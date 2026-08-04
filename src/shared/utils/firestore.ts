import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as limitQuery,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type OrderByDirection,
  type QueryConstraint,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { todayKey } from './format'

export function ts(input?: Date): { seconds: number; nanoseconds: number } {
  const d = input || new Date()
  return { seconds: Math.floor(d.getTime() / 1000), nanoseconds: (d.getTime() % 1000) * 1e6 }
}

export function fromTs(t?: Timestamp | { seconds: number } | null): Date | null {
  if (!t) return null
  return new Date('seconds' in t ? t.seconds * 1000 : (t as Timestamp).toMillis())
}

export async function waitFor<T>(fn: () => Promise<T>): Promise<T> {
  return fn()
}

export interface ListParams {
  storeId?: string
  userId?: string
  where?: Record<string, { value: unknown; operator?: '==' | 'array-contains' | 'in' }>
  orderBy?: { field: string; dir?: OrderByDirection }
  limit?: number
}

export async function listDocs<T>(path: string, params: ListParams = {}): Promise<T[]> {
  const constraints: QueryConstraint[] = []
  if (params.storeId) constraints.push(where('storeId', '==', params.storeId))
  if (params.userId) constraints.push(where('userId', '==', params.userId))
  if (params.where) {
    for (const [field, { value, operator }] of Object.entries(params.where)) {
      constraints.push(where(field, operator || '==', value))
    }
  }
  if (params.orderBy) constraints.push(orderBy(params.orderBy.field, params.orderBy.dir || 'desc'))
  if (params.limit) constraints.push(limitQuery(params.limit))
  return snapshotList<T>(await getDocs(query(collection(db, path), ...constraints)))
}

export async function getDocById<T>(path: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, path, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as DocumentData) } as T
}

export async function createDoc<T extends { id?: string }>(path: string, data: Omit<T, 'id'>, userId = 'system'): Promise<T> {
  const withMeta = {
    ...(data as unknown as Record<string, unknown>),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  }
  const ref = await addDoc(collection(db, path), withMeta)
  return { ...(data as unknown as Record<string, unknown>), id: ref.id } as T
}

export async function updateDocById(path: string, id: string, data: Record<string, unknown>): Promise<void> {
  await updateDoc(doc(db, path, id), { ...data, updatedAt: serverTimestamp() })
}

export async function setDocById<T>(path: string, id: string, data: Omit<T, 'id'>, userId = 'system'): Promise<void> {
  await setDoc(doc(db, path, id), {
    ...(data as unknown as Record<string, unknown>),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  })
}

export async function deleteDocById(path: string, id: string): Promise<void> {
  await deleteDoc(doc(db, path, id))
}

export function subscribeCollection<T>(
  path: string,
  params: ListParams,
  onData: (items: T[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const constraints: QueryConstraint[] = []
  if (params.storeId) constraints.push(where('storeId', '==', params.storeId))
  if (params.userId) constraints.push(where('userId', '==', params.userId))
  if (params.where) {
    for (const [field, { value, operator }] of Object.entries(params.where)) {
      constraints.push(where(field, operator || '==', value))
    }
  }
  if (params.orderBy) constraints.push(orderBy(params.orderBy.field, params.orderBy.dir || 'desc'))
  return onSnapshot(query(collection(db, path), ...constraints), {
    next: (snap) => onData(snapshotList<T>(snap)),
    error: onError,
  })
}

function snapshotList<T>(snap: { docs: { id: string; data: () => DocumentData }[] }): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as T)
}

export { serverTimestamp, todayKey }
