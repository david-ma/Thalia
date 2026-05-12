/**
 * Normalize site config / secrets album fields into SmugMug upload header `X-Smug-AlbumUri`.
 *
 * @see SmugMug API v2 — upload headers expect an album **URI path** rooted at `/api/v2/album/…`.
 */

function trimTrailingSlash(p: string): string {
  return p.replace(/\/+$/, '')
}

/**
 * Produce the value for `X-Smug-AlbumUri` on `upload.smugmug.com` POST uploads.
 *
 * Accepts:
 * - Bare album key (`AbCd`).
 * - API-relative path (`/api/v2/album/AbCd`; trailing slashes trimmed).
 * - Full **API** URL (`https://api.smugmug.com/api/v2/album/AbCd`; query stripped).
 * - Paste without leading slash (`api/v2/album/AbCd`).
 *
 * Other `https://` URLs (gallery pages, CDN, etc.) return **''** — use the API Album URI copied from tooling.
 */
export function normalizeSmugMugAlbumUri(raw: string): string {
  const s = raw.trim()
  if (!s) return ''

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      const pathname = trimTrailingSlash((u.pathname || '').split('?')[0] ?? '')
      return pathname.startsWith('/api/v2/album/') ? pathname : ''
    } catch {
      return ''
    }
  }

  const noQuery = trimTrailingSlash(s.split('?')[0]!)
  let rel = trimTrailingSlash(noQuery.replace(/^\/+/, '/'))

  if (/^api\/v2\/album\//i.test(rel)) {
    rel = '/' + rel
  }

  if (rel.startsWith('/api/v2/album/')) {
    return rel
  }

  rel = rel.replace(/^\/+/, '')
  rel = rel.replace(/^api\/v2\/album\//i, '')

  return rel ? `/api/v2/album/${rel}` : ''
}
