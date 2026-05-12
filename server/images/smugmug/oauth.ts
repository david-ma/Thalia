/**
 * Pure OAuth 1.0a helpers for SmugMug (HMAC-SHA1, parameter encoding).
 * Used by {@link SmugMugClient}; keep stable when adding golden-vector tests.
 */

import crypto from 'crypto'

export function smugmugSortParams(object: Record<string, string>): Record<string, string> {
  const keys = Object.keys(object).sort()
  const result: Record<string, string> = {}
  keys.forEach(function (key) {
    result[key] = object[key]
  })
  return result
}

/**
 * Normalised OAuth parameter string for the signature base string (before the outer
 * {@link smugmugOauthEscape} in {@link SmugMugClient.signRequest}).
 *
 * **Limitation:** values must not contain raw `&` or `=`; those characters break the
 * `key=value&…` join. Typical SmugMug OAuth fields are alphanumeric; use
 * {@link smugmugOauthEscape} on untrusted inputs before placing them in `params`.
 */
export function smugmugExpandParams(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
}

export function smugmugOauthEscape(s: string): string {
  if (s === undefined) {
    return ''
  }
  return encodeURIComponent(s)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

export function smugmugB64HmacSha1(key: string, data: string): string {
  return crypto.createHmac('sha1', key).update(data).digest('base64')
}

export function smugmugBundleAuthorization(url: string, params: Record<string, string>): string {
  const keys = Object.keys(params)
  const authorization = `OAuth realm="${url}",${keys
    .map((key) => {
      let value: string = params[key]
      if (key === 'oauth_signature') {
        value = smugmugOauthEscape(value)
      }
      return `${key}="${value}"`
    })
    .join(',')}`

  return authorization
}
