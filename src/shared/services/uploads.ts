import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { storage, functions } from '../firebase'
import { uid } from '../utils/validators'
import { normalizeStoreLogo } from '../utils/logo-normalize'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface UploadError {
  code: 'type' | 'size' | 'empty' | 'failed' | 'quota'
  message: string
}

export interface StorageQuota {
  usedBytes: number
  limitBytes: number
  limitReached: boolean
  remainingBytes: number | null
  usedPercent: number
}

/**
 * Reads the authoritative storage quota from the server (the `storageUsed`
 * counter maintained by the Storage triggers, compared against the plan limit).
 * Returns null on any transport/auth failure so callers can fall back to a
 * permissive upload (the server trigger still enforces the hard limit).
 */
export async function fetchStorageQuota(storeId: string): Promise<StorageQuota | null> {
  try {
    const res = await httpsCallable(functions, 'checkStorageQuota')({ storeId })
    return (res.data as StorageQuota) || null
  } catch {
    return null
  }
}

/**
 * Client-side pre-upload gate. Throws an UploadError('quota') if the file would
 * exceed the merchant's plan storage limit — so the merchant sees a clear,
 * actionable message instead of a silent server-side reject. The server Storage
 * trigger remains the authoritative enforcement.
 */
export async function assertStorageQuota(storeId: string, fileSize: number): Promise<void> {
  const q = await fetchStorageQuota(storeId)
  if (!q || q.limitBytes <= 0) return
  if (q.remainingBytes !== null && fileSize > q.remainingBytes) {
    throw { code: 'quota', message: 'وصلت إلى حد التخزين في باقتك — ارفع باقتك لرفع المزيد من الصور.' } as UploadError
  }
}

/** Validates a file before upload. Returns an Arabic error or null. */
export function validateImageFile(file: File): UploadError | null {
  if (!file || !file.type) return { code: 'empty', message: 'اختر صورة صالحة أولاً' }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { code: 'type', message: 'صيغة الملف غير مدعومة — استخدم JPG أو PNG أو WebP أو GIF' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { code: 'size', message: 'حجم الصورة كبير جداً — الحد الأقصى 5 ميجابايت' }
  }
  return null
}

export function extFromType(type: string): string {
  switch (type) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    case 'application/pdf':
      return 'pdf'
    default:
      return 'jpg'
  }
}

/** Maps a Firebase/Storage error to a precise Arabic message for the merchant. */
export function uploadErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string } | null
  // Client-side quota gate throws an UploadError('quota') with a ready message.
  if (err?.code === 'quota' && err.message) return err.message
  const code = err?.code || ''
  switch (code) {
    case 'storage/unauthorized':
      return 'لا تملك صلاحية الرفع لهذا المتجر في التخزين'
    case 'storage/quota-exceeded':
      return 'تم تجاوز حصة التخزين المسموحة لهذا المتجر'
    case 'storage/canceled':
      return 'أُلغيت عملية رفع الصورة'
    case 'storage/retry-limit-exceeded':
    case 'storage/network-error':
      return 'تعذر الاتصال بخادم التخزين — تحقق من اتصالك وحاول مجدداً'
    default:
      return 'فشل رفع الصورة — تحقق من اتصالك وحاول مجدداً'
  }
}

async function fileAsBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

/** Uses the server-checked path only when a direct Storage upload is denied.
 * This keeps resumable direct uploads as the normal fast path while making a
 * valid merchant upload resilient to a stale Storage-rule entitlement. */
async function uploadWithFallback(file: File, input: { storeId: string; assetType: 'product' | 'store' | 'landing'; productId?: string }): Promise<string> {
  const result = await httpsCallable(functions, 'uploadMerchantImage')({
    ...input,
    fileName: file.name,
    contentType: file.type,
    base64: await fileAsBase64(file),
  })
  const url = String((result.data as { url?: string })?.url || '')
  if (!url) throw new Error('لم تُرجع خدمة الرفع رابط الصورة')
  return url
}

function shouldUseUploadFallback(error: unknown) {
  const code = String((error as { code?: string } | null)?.code || '')
  // Do not retry an intentional cancellation or a known capacity limit. Every
  // other Storage SDK failure may be caused by a browser-side rule/session
  // mismatch, so hand the same validated image to the server-authorized route.
  // This keeps merchants able to upload a logo, banner, or product photo even
  // when a browser holds an outdated Storage auth token.
  return code !== 'storage/canceled' && code !== 'storage/quota-exceeded'
}

/** Validates payment proof files independently from storefront images. */
export function validatePaymentProofFile(file: File): UploadError | null {
  if (!file || !file.type) return { code: 'empty', message: 'اختر إثبات تحويل صالحاً أولاً' }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowed.includes(file.type)) {
    return { code: 'type', message: 'صيغة إثبات التحويل غير مدعومة — استخدم JPG أو PNG أو WebP أو PDF' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { code: 'size', message: 'حجم إثبات التحويل كبير جداً — الحد الأقصى 5 ميجابايت' }
  }
  return null
}

/**
 * Builds the product image path `stores/{storeId}/products/{productId}/...`
 * (matches storage.rules, which require `metadata.storeId == storeId`).
 */
export function productImagePath(storeId: string, productId: string, file: File): string {
  const ext = extFromType(file.type)
  const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'image'
  return `stores/${storeId}/products/${productId}/${Date.now()}-${uid(6)}-${clean}.${ext}`
}

/**
 * Uploads a product image into the product's own folder
 * `stores/{storeId}/products/{productId}/...`. Returns the download URL.
 * `productId` must be the product document id — for new products it is
 * generated client-side BEFORE any upload, so all images land in the same folder.
 */
export async function uploadProductImage(
  file: File,
  storeId: string,
  productId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  await assertStorageQuota(storeId, file.size).catch((e) => {
    if (e && (e as UploadError).code === 'quota') throw e
  })
  const storageRef = ref(storage, productImagePath(storeId, productId, file))
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { storeId },
  })
  task.on(
    'state_changed',
    (snap) => {
      const pct = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0
      onProgress?.(pct)
    },
  )
  try {
    await task
    return getDownloadURL(storageRef)
  } catch (error) {
    if (!shouldUseUploadFallback(error)) throw error
    return uploadWithFallback(file, { storeId, assetType: 'product', productId })
  }
}

/** Deletes an uploaded image given its download URL (best-effort). */
export async function deleteProductImage(downloadUrl: string): Promise<void> {
  try {
    const u = new URL(downloadUrl)
    const m = u.pathname.match(/\/o\/(.+)/)
    if (!m) return
    const path = decodeURIComponent(m[1])
    const storageRef = ref(storage, path)
    await deleteObject(storageRef)
  } catch {
    // The object may already be gone or the URL is a legacy/external URL.
  }
}

/**
 * Uploads a store logo/brand asset to `stores/{storeId}/...` (matches
 * storage.rules, which require `metadata.storeId == storeId`). Returns the
 * download URL.
 */
export async function uploadStoreLogo(file: File, storeId: string): Promise<string> {
  await assertStorageQuota(storeId, file.size).catch((e) => {
    if (e && (e as UploadError).code === 'quota') throw e
  })
  // Trim transparent padding so the VISIBLE logo fills the header/footer box.
  const normalized = await normalizeStoreLogo(file)
  const ext = extFromType(normalized.type)
  const clean = normalized.name.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'logo'
  const storageRef = ref(storage, `stores/${storeId}/logo-${Date.now()}-${uid(6)}-${clean}.${ext}`)
  try {
    await uploadBytesResumable(storageRef, normalized, {
      contentType: normalized.type,
      customMetadata: { storeId },
    })
    return getDownloadURL(storageRef)
  } catch (error) {
    if (!shouldUseUploadFallback(error)) throw error
    return uploadWithFallback(normalized, { storeId, assetType: 'store' })
  }
}

/**
 * Uploads a store hero/banner image to `stores/{storeId}/...` (matches
 * storage.rules, which require `metadata.storeId == storeId`). Returns the
 * download URL.
 */
export async function uploadStoreHero(file: File, storeId: string, onProgress?: (pct: number) => void): Promise<string> {
  await assertStorageQuota(storeId, file.size).catch((e) => {
    if (e && (e as UploadError).code === 'quota') throw e
  })
  const ext = extFromType(file.type)
  const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'hero'
  const storageRef = ref(storage, `stores/${storeId}/hero-${Date.now()}-${uid(6)}-${clean}.${ext}`)
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { storeId },
  })
  task.on('state_changed', (snap) => {
    const pct = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0
    onProgress?.(pct)
  })
  try {
    await task
    return getDownloadURL(storageRef)
  } catch (error) {
    if (!shouldUseUploadFallback(error)) throw error
    return uploadWithFallback(file, { storeId, assetType: 'store' })
  }
}

/**
 * Uploads a landing page asset (hero or section image) to
 * `landingPages/{storeId}/...` (matches storage.rules, which require
 * `metadata.storeId == storeId`). Returns the download URL.
 */
export async function uploadLandingImage(file: File, storeId: string, onProgress?: (pct: number) => void): Promise<string> {
  await assertStorageQuota(storeId, file.size).catch((e) => {
    if (e && (e as UploadError).code === 'quota') throw e
  })
  const ext = extFromType(file.type)
  const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'landing'
  const storageRef = ref(storage, `landingPages/${storeId}/${Date.now()}-${uid(6)}-${clean}.${ext}`)
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { storeId },
  })
  task.on('state_changed', (snap) => {
    const pct = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0
    onProgress?.(pct)
  })
  try {
    await task
    return getDownloadURL(storageRef)
  } catch (error) {
    if (!shouldUseUploadFallback(error)) throw error
    return uploadWithFallback(file, { storeId, assetType: 'landing' })
  }
}

/**
 * Uploads a payment proof / transfer screenshot to
 * `documents/{storeId}/payment-proofs/...`. This dedicated path remains
 * writable for an owned store even after a trial/period expires, allowing a
 * merchant to submit reactivation proof without opening ordinary documents.
 */
export async function uploadPaymentProof(file: File, storeId: string, onProgress?: (pct: number) => void): Promise<string> {
  const validation = validatePaymentProofFile(file)
  if (validation) throw validation
  await assertStorageQuota(storeId, file.size).catch((e) => {
    if (e && (e as UploadError).code === 'quota') throw e
  })
  const ext = extFromType(file.type)
  const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'proof'
  const storageRef = ref(storage, `documents/${storeId}/payment-proofs/payment-${Date.now()}-${uid(6)}-${clean}.${ext}`)
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { storeId },
  })
  task.on('state_changed', (snap) => {
    const pct = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0
    onProgress?.(pct)
  })
  await task
  return getDownloadURL(storageRef)
}
