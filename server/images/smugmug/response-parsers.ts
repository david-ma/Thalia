/**
 * Parse and validate JSON from SmugMug HTTP responses used by the upload pipeline.
 *
 * - {@link parseSmugMugMultipartUploadResponse} — `POST https://upload.smugmug.com/` ack
 * - {@link parseSmugMugVerbosityAlbumImage}     — `GET api.smugmug.com/…?_verbosity=1` AlbumImage
 */

import type { SmugMugUploadAck } from './save-image-map.js'

/**
 * Parse and validate the JSON ack from `POST https://upload.smugmug.com/`.
 * @throws If HTTP status is not 2xx, JSON is invalid, or required `Image` fields are missing.
 */
export function parseSmugMugMultipartUploadResponse(
  statusCode: number | undefined,
  body: string,
): SmugMugUploadAck {
  const code = typeof statusCode === 'number' ? statusCode : 0
  if (code < 200 || code >= 300) {
    throw new Error(`SmugMug upload failed (HTTP ${code || 'unknown'})`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body || 'null')
  } catch {
    throw new Error('SmugMug upload returned invalid JSON')
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('SmugMug upload returned an invalid payload')
  }

  const root = parsed as Record<string, unknown>
  const image = root.Image
  if (image === null || typeof image !== 'object' || Array.isArray(image)) {
    throw new Error('SmugMug upload response missing Image object')
  }

  const img = image as Record<string, unknown>
  if (typeof img.AlbumImageUri !== 'string' || !img.AlbumImageUri.trim()) {
    throw new Error('SmugMug upload response missing Image.AlbumImageUri')
  }
  if (typeof img.URL !== 'string') {
    throw new Error('SmugMug upload response missing Image.URL')
  }
  if (typeof img.ImageUri !== 'string') {
    throw new Error('SmugMug upload response missing Image.ImageUri')
  }

  return parsed as SmugMugUploadAck
}

/**
 * Extract `AlbumImage` from a SmugMug API v2 `?_verbosity=1` response body.
 * @throws If JSON is invalid or `Response.AlbumImage` is missing or not an object.
 */
export function parseSmugMugVerbosityAlbumImage(body: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error('SmugMug API returned invalid JSON')
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('SmugMug API returned an invalid payload')
  }

  const root = parsed as Record<string, unknown>
  const response = root.Response
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('SmugMug API response missing Response')
  }

  const resp = response as Record<string, unknown>
  const albumImage = resp.AlbumImage
  if (albumImage === null || typeof albumImage !== 'object' || Array.isArray(albumImage)) {
    throw new Error('SmugMug API response missing Response.AlbumImage')
  }

  return albumImage as Record<string, unknown>
}
