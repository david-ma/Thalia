/**
 * Parse and validate JSON from `POST https://upload.smugmug.com/` (multipart upload ack).
 */

import type { SmugMugUploadAck } from './smugmug/save-image-map.js'

/**
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
