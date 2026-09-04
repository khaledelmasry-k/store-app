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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function isInvalidNumber(v: unknown): boolean {
  return typeof v === 'number' && !Number.isFinite(v)
}

/**
 * Recursively strips values that Firestore rejects before a write.
 * - Drops keys whose value is `undefined` (incl. inside nested objects).
 * - Drops `undefined` / `NaN` / `Infinity` array elements.
 * - Preserves `null` and empty strings as-is.
 * - Passes opaque instances (Timestamps, `serverTimestamp()`/FieldValue
 *   sentinels, Date, GeoPoint, Blob, references) through untouched.
 * - Throws a useful Arabic error when a non-numeric field receives `NaN`.
 */
export function sanitizeForFirestore(value: unknown, keyPath = ''): unknown {
  if (value === null) return null
  const t = typeof value
  if (t === 'string' || t === 'boolean') return value
  if (t === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`قيمة غير صالحة في الحقل "${keyPath}"`)
    }
    return value
  }
  if (t === 'undefined') return undefined
  if (t === 'object') {
    if (Array.isArray(value)) {
      return value
        .map((item, i) => {
          if (isInvalidNumber(item)) return undefined
          return sanitizeForFirestore(item, keyPath ? `${keyPath}[${i}]` : `[${i}]`)
        })
        .filter((item) => item !== undefined && !isInvalidNumber(item))
    }
    if (!isPlainObject(value)) return value
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      const cleaned = sanitizeForFirestore(v, keyPath ? `${keyPath}.${k}` : k)
      if (cleaned === undefined || isInvalidNumber(cleaned)) continue
      out[k] = cleaned
    }
    return out
  }
  return value
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
  const withMeta = sanitizeForFirestore({
    ...(data as unknown as Record<string, unknown>),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  }) as Record<string, unknown>
  const ref = await addDoc(collection(db, path), withMeta)
  return { ...(data as unknown as Record<string, unknown>), id: ref.id } as T
}

export async function updateDocById(path: string, id: string, data: Record<string, unknown>): Promise<void> {
  await updateDoc(
    doc(db, path, id),
    sanitizeForFirestore({ ...data, updatedAt: serverTimestamp() }) as Record<string, unknown>,
  )
}

export async function setDocById<T>(path: string, id: string, data: Omit<T, 'id'>, userId = 'system'): Promise<void> {
  await setDoc(
    doc(db, path, id),
    sanitizeForFirestore({
      ...(data as unknown as Record<string, unknown>),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    }) as Record<string, unknown>,
  )
}

/** Upsert a document while preserving fields not included in this update. */
export async function mergeDocById(path: string, id: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(
    doc(db, path, id),
    sanitizeForFirestore({ ...data, updatedAt: serverTimestamp() }) as Record<string, unknown>,
    { merge: true },
  )
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
