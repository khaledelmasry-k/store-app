/**
 * Client-side normalization for MERCHANT store logos (tenant assets — nothing
 * to do with the M&K platform brand mark).
 *
 * The only transformation applied is removing fully-transparent borders from
 * images that actually have an alpha channel. A "logo file" with large empty
 * transparent margins otherwise renders as a tiny stamp inside the storefront
 * header/footer box even though the container is sized correctly. We crop the
 * empty margins (never any part of the real logo), keep everything else
 * (colors, alpha, proportions) untouched, and only scale uniformly so the asset
 * stays small enough to upload quickly. Fully-opaque images (JPG, or a PNG
 * with no alpha) are returned unchanged — no risky auto-crop there.
 */

/** Alpha ≤ this is treated as "empty" padding. */
const EMPTY_ALPHA = 32

/** Longest side of the trimmed asset; logos render far below this size. */
const MAX_DIMENSION = 512

/** Minimal absolute empty border (px per side) worth trimming. */
const MIN_EMPTY_BORDER = 2

/** Empty border must be at least this fraction of the shorter side to act. */
const MIN_EMPTY_FRACTION = 0.04

function decodeFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unable to decode logo'))
    }
    img.src = url
  })
}

async function loadImage(file: File): Promise<HTMLImageElement | null> {
  try {
    return await decodeFile(file)
  } catch {
    return null
  }
}

/**
 * Returns a trimmed version of `file` when it is an image with a real
 * alpha channel and genuinely empty transparent borders; otherwise returns the
 * original `file` untouched. Never crops opaque images and never distorts the
 * logo's proportions or colors.
 */
export async function normalizeStoreLogo(file: File): Promise<File> {
  const image = await loadImage(file)
  if (!image || !image.naturalWidth || !image.naturalHeight) return file

  const w = image.naturalWidth
  const h = image.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return file

  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(image, 0, 0)
  let data: ImageData
  try {
    data = ctx.getImageData(0, 0, w, h)
  } catch {
    return file // tainted canvas (cross-origin source) — leave the file alone
  }

  const px = data.data
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > EMPTY_ALPHA) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return file // fully transparent — keep the original

  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  const left = minX
  const right = w - 1 - maxX
  const top = minY
  const bottom = h - 1 - maxY
  const emptyW = Math.min(left, right)
  const emptyH = Math.min(top, bottom)
  const shorter = Math.min(w, h)

  // Nothing meaningfully empty → keep the original (no re-encode).
  if (emptyW <= MIN_EMPTY_BORDER && emptyH <= MIN_EMPTY_BORDER) return file
  if (emptyW * (1 / MIN_EMPTY_FRACTION) < shorter && emptyH * (1 / MIN_EMPTY_FRACTION) < shorter) return file

  const scale = Math.min(1, MAX_DIMENSION / Math.max(cw, ch))
  canvas.width = Math.max(1, Math.round(cw * scale))
  canvas.height = Math.max(1, Math.round(ch * scale))
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, minX, minY, cw, ch, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return file
  const base = file.name.replace(/\.[a-z0-9]+$/i, '')
  return new File([blob], `${base}.png`, { type: 'image/png', lastModified: file.lastModified })
}