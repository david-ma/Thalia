import type { ServerResponse } from 'http'
import type { Website } from '../website.js'

export function sendAuthHtml(res: ServerResponse, website: Website, view: string, data: Record<string, unknown> = {}): void {
  if (!res.headersSent) {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
  }
  res.end(website.getContentHtml(view)(data))
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
