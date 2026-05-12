import type { IncomingMessage } from 'http'
import type { Website } from '../website.js'

/** Default cookie + DB session lifetime when `config.thaliaAuth.sessionMaxAgeSeconds` is unset */
export const DEFAULT_THALIA_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export function sessionMaxAgeSecondsForWebsite(website: Website): number {
  return website.config.thaliaAuth?.sessionMaxAgeSeconds ?? DEFAULT_THALIA_SESSION_MAX_AGE_SECONDS
}

function cookieIsSecureHttps(req: IncomingMessage, website: Website): boolean {
  const xf = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim()
  return xf === 'https' || (website.env === 'production' && xf !== 'http')
}

/** Used by auth controllers to set the session cookie (not re-exported from package barrel). */
export function buildSessionCookieValue(
  sessionId: string,
  maxAgeSeconds: number,
  req: IncomingMessage,
  website: Website,
): string {
  const parts = [
    `sessionId=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAgeSeconds)}`,
  ]
  if (cookieIsSecureHttps(req, website)) parts.push('Secure')
  return parts.join('; ')
}

/** Clears session cookie on logout. */
export function buildClearedSessionCookie(req: IncomingMessage, website: Website): string {
  const parts = [
    'sessionId=',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ]
  if (cookieIsSecureHttps(req, website)) parts.push('Secure')
  return parts.join('; ')
}
