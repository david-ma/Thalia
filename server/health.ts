/**
 * Operator health snapshot for Thalia sites.
 *
 * HTTP: GET /health — gated by env `THALIA_HEALTH_TOKEN`.
 * - Token unset/empty → 404 (route appears absent)
 * - Missing/wrong token → 401
 * - Valid token → 200 (ok) or 503 (!ok) with JSON body
 *
 * Auth: `Authorization: Bearer <token>` or `X-Thalia-Health-Token: <token>`
 */

import crypto from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { sql } from 'drizzle-orm'
import type { RequestInfo } from './server.js'
import type { DatabaseInitReport, MachineReport } from './types.js'
import type { Website, Controller } from './website.js'

export type WebsiteHealthDbStatus = {
  connected: boolean
}

export type WebsiteHealthSnapshot = {
  ok: boolean
  website: string
  checkedAt: string
  db: WebsiteHealthDbStatus
  machines: MachineReport[]
  lastInit: DatabaseInitReport | null
}

/** Read expected token from env (trim). Empty / unset → health HTTP disabled. */
export function thaliaHealthTokenFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.THALIA_HEALTH_TOKEN?.trim()
  return raw ? raw : null
}

/** Extract bearer or X-Thalia-Health-Token from the request. */
export function extractHealthToken(req: IncomingMessage): string | null {
  const headerToken = req.headers['x-thalia-health-token']
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim()
  }
  if (Array.isArray(headerToken) && headerToken[0]?.trim()) {
    return headerToken[0].trim()
  }

  const auth = req.headers.authorization
  if (typeof auth === 'string') {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim())
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return null
}

/** Constant-time string compare (length mismatch → false). */
export function healthTokensEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(provided, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * Gate result for /health:
 * - `disabled` → respond 404
 * - `unauthorized` → respond 401
 * - `ok` → proceed
 */
export function evaluateHealthTokenGate(
  req: IncomingMessage,
  env: NodeJS.ProcessEnv = process.env,
): 'disabled' | 'unauthorized' | 'ok' {
  const expected = thaliaHealthTokenFromEnv(env)
  if (!expected) return 'disabled'
  const provided = extractHealthToken(req)
  if (!provided || !healthTokensEqual(expected, provided)) return 'unauthorized'
  return 'ok'
}

async function probeDbConnected(website: Website): Promise<boolean> {
  const drizzle = website.db?.drizzle
  if (!drizzle) return false
  try {
    await drizzle.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}

/** Build a non-sensitive health snapshot (safe for gated /health JSON). */
export async function buildWebsiteHealth(website: Website): Promise<WebsiteHealthSnapshot> {
  const checkedAt = new Date().toISOString()
  const connected = await probeDbConnected(website)

  const machinesMap = website.db?.machines ?? {}
  const machines: MachineReport[] = await Promise.all(
    Object.entries(machinesMap).map(async ([name, machine]) => {
      try {
        const report = await machine.health()
        return { ...report, name: report.name || name }
      } catch (e) {
        return {
          name,
          status: 'error' as const,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    }),
  )

  const lastInit = website.db?.lastInitReport ?? null
  const ok = connected && machines.every((m) => m.status !== 'error')

  return {
    ok,
    website: website.name,
    checkedAt,
    db: { connected },
    machines,
    lastInit,
  }
}

function endJson(res: ServerResponse, statusCode: number, body: unknown): void {
  if (res.writableEnded || res.headersSent) return
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

/**
 * GET /health — operator readiness JSON.
 * Registered by default on every Website; gated by `THALIA_HEALTH_TOKEN`.
 */
export const health: Controller = (res, req, website, _requestInfo: RequestInfo) => {
  void handleHealth(res, req, website)
}

async function handleHealth(
  res: ServerResponse,
  req: IncomingMessage,
  website: Website,
): Promise<void> {
  try {
    const gate = evaluateHealthTokenGate(req)
    if (gate === 'disabled') {
      endJson(res, 404, { error: 'Not found' })
      return
    }
    if (gate === 'unauthorized') {
      endJson(res, 401, { error: 'Unauthorized' })
      return
    }

    const snapshot = await buildWebsiteHealth(website)
    endJson(res, snapshot.ok ? 200 : 503, snapshot)
  } catch (error) {
    console.error(
      `Error in ${website.name}/health: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
    endJson(res, 500, { error: 'Internal Server Error' })
  }
}
