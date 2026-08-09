import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from 'firebase/storage'
import { storage } from '../firebase'
import { uid } from '../utils/validators'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface UploadError {
  code: 'type' | 'size' | 'empty' | 'failed'
  message: string
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
    default:
      return 'jpg'
  }
}

/**
 * Uploads a product image to `products/{storeId}/...` (matches storage.rules,
 * which require `metadata.storeId == storeId`). Returns the download URL.
 */
export async function uploadProductImage(
  file: File,
  storeId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const ext = extFromType(file.type)
  const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'image'
  const storageRef = ref(storage, `products/${storeId}/${Date.now()}-${uid(6)}-${clean}.${ext}`)
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
  await task
  return getDownloadURL(storageRef)
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
  const ext = extFromType(file.type)
  const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'logo'
  const storageRef = ref(storage, `stores/${storeId}/logo-${Date.now()}-${uid(6)}-${clean}.${ext}`)
  await uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { storeId },
  })
  return getDownloadURL(storageRef)
}

/**
 * Uploads a store hero/banner image to `stores/{storeId}/...` (matches
 * storage.rules, which require `metadata.storeId == storeId`). Returns the
 * download URL.
 */
export async function uploadStoreHero(file: File, storeId: string, onProgress?: (pct: number) => void): Promise<string> {
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
  await task
  return getDownloadURL(storageRef)
}

/**
 * Uploads a payment proof / transfer screenshot to `documents/{storeId}/...`
 * (matches storage.rules `documents` path for merchant-uploaded evidence).
 */
export async function uploadPaymentProof(file: File, storeId: string, onProgress?: (pct: number) => void): Promise<string> {
  const ext = extFromType(file.type)
  const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'proof'
  const storageRef = ref(storage, `documents/${storeId}/payment-${Date.now()}-${uid(6)}-${clean}.${ext}`)
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
