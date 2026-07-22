import type { ServerResponse } from 'http'
import type { Website } from '../website.js'

/** Handlebars flags for `userLogin` — derived from `config.thaliaAuth`. */
export function authLoginNavFlags(website: Website): {
  userCreateAllowed: boolean
  passwordResetAllowed: boolean
} {
  const auth = website.config.thaliaAuth
  return {
    userCreateAllowed: auth?.disableSelfRegistration !== true,
    passwordResetAllowed: auth?.disablePasswordReset !== true,
  }
}

/** Merge auth nav flags into template data (explicit `data` values win). */
export function withAuthLoginNavFlags(
  website: Website,
  data: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...authLoginNavFlags(website), ...data }
}

export function sendAuthHtml(res: ServerResponse, website: Website, view: string, data: Record<string, unknown> = {}): void {
  if (!res.headersSent) {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
  }
  const payload = view === 'userLogin' ? withAuthLoginNavFlags(website, data) : data
  res.end(website.getContentHtml(view)(payload))
}

export function requireDbConnection(res: ServerResponse, website: Website): boolean {
  if (website.db?.drizzle != null && website.db.machines != null) {
    return true
  }
  if (!res.headersSent) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
  }
  res.end(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Service unavailable</title></head><body>' +
      '<h1>Service unavailable</h1>' +
      '<p>The database is not connected. Set <code>DATABASE_URL</code> and run migrations (<code>drizzle-kit push</code>), then restart.</p>' +
      '</body></html>',
  )
  return false
}
