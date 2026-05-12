/**
 * Parse JSON from SmugMug API v2 `?_verbosity=1` responses used after upload (`AlbumImage` payload).
 */

/**
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
