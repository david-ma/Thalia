/**
 * Public /version and gated /health JSON endpoints.
 *
 * GET /version — benign build/runtime metadata (public).
 *
 * GET /health — operator readiness snapshot, gated by `THALIA_HEALTH_TOKEN`.
 * - Token unset/empty → 404
 * - Missing/wrong token → 401
 * - Valid → 200 (ok) or 503 (!ok)
 *
 * Auth: `Authorization: Bearer <token>` or `X-Thalia-Health-Token: <token>`
 *
 * Snapshot includes count-based drizzle migration lag (`migrations`) when the
 * site has `drizzle.config.ts` + an `out` migrations directory. No hash/journal
 * set-diff — see `drizzle-migration-status.ts`.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { sql } from 'drizzle-orm'
import {
  migrationsFailHealth,
  probeWebsiteMigrations,
  type WebsiteHealthMigrationsStatus,
} from './drizzle-migration-status.js'
import type { DatabaseReconnectStatus } from './database-boot.js'
import type { RequestInfo } from './server.js'
import type { DatabaseInitReport, MachineReport } from './types.js'
import type { Website, Controller } from './website.js'

export type WebsiteHealthDbStatus = {
  configured: boolean
  required: boolean
  connected: boolean
  reconnecting: boolean
  attemptIndex: number
  nextAttemptAt: string | null
  scheduleExhausted: boolean
}

/** Non-machine config load status (hollow boot when loaded=false). */
export type WebsiteHealthConfigStatus = {
  loaded: boolean
  /** How config was obtained */
  source: 'file' | 'defaults' | 'error'
  /** Short error when source is `error` — no stack traces */
  error?: string
}

export type { WebsiteHealthMigrationsStatus }

export type WebsiteHealthSnapshot = {
  schemaVersion: 2
  identity: Website['buildMetadata']['identity'] | null
  diagnostics: Website['buildMetadata']['diagnostics'] | null
  checks: Record<string, { state: 'success' | 'failure' | 'skipped'; reason: string }>
  readinessReasons: string[]
  ok: boolean
  website: string
  checkedAt: string
  config: WebsiteHealthConfigStatus
  db: WebsiteHealthDbStatus
  /** Count-based drizzle lag; skipped when no migrations dir / no DB. */
  migrations: WebsiteHealthMigrationsStatus
  machines: MachineReport[]
  lastInit: DatabaseInitReport | null
}

/** Expected health token from env (trim). Empty / unset → /health disabled. */
export function thaliaHealthTokenFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.THALIA_HEALTH_TOKEN?.trim()
  return raw ? raw : null
}

/** Bearer or X-Thalia-Health-Token from the request. */
export function extractHealthToken(req: IncomingMessage): string | null {
  const headerToken = req.headers['x-thalia-health-token']
  if (typeof headerToken === 'string' && headerToken.trim()) return headerToken.trim()
  if (Array.isArray(headerToken) && headerToken[0]?.trim()) return headerToken[0].trim()

  const auth = req.headers.authorization
  if (typeof auth === 'string') {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim())
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return null
}

/** Gate: disabled (no env token) | unauthorized | ok */
export function evaluateHealthTokenGate(
  req: IncomingMessage,
  env: NodeJS.ProcessEnv = process.env,
): 'disabled' | 'unauthorized' | 'ok' {
  const expected = thaliaHealthTokenFromEnv(env)
  if (!expected) return 'disabled'
  const provided = extractHealthToken(req)
  if (!provided || provided !== expected) return 'unauthorized'
  return 'ok'
}

async function probeDbConnected(website: Website): Promise<boolean> {
  const drizzle = website.db?.drizzle
  if (!drizzle) return false

  return drizzle
    .execute(sql`SELECT 1`)
    .then(() => true)
    .catch(() => false)
}

/** Non-sensitive readiness snapshot for gated /health. */
export async function buildWebsiteHealth(website: Website): Promise<WebsiteHealthSnapshot> {
  const checkedAt = new Date().toISOString()
  const connected = await probeDbConnected(website)

  const config: WebsiteHealthConfigStatus = website.configStatus
    ? {
        loaded: website.configStatus.loaded,
        source: website.configStatus.source,
        ...(website.configStatus.error ? { error: 'config-load-failed' } : {}),
      }
    : { loaded: true, source: 'defaults' }

  const configured = !!website.config?.database
  const required = configured || !!website.db
  const machinesMap = website.db?.machines ?? {}
  const expectedMachines = Object.keys(website.config?.database?.machines ?? {})
  const machines: MachineReport[] = await Promise.all(
    Object.entries(machinesMap).map(async ([name, machine]) => {
      try {
        const report = await machine.health()
        return {
          name,
          status: ['ok', 'degraded', 'error'].includes(report.status) ? report.status : 'error',
          ...(report.error ? { error: 'machine-reported-error' } : {}),
        }
      } catch (e) {
        return {
          name,
          status: 'error' as const,
          error: 'machine-health-failed',
        }
      }
    }),
  )

  const migrations = await probeWebsiteMigrations({
    rootPath: website.rootPath,
    drizzle: connected ? website.db?.drizzle : null,
  })

  const init = website.db?.lastInitReport
  const lastInit = init
    ? {
        website: website.name,
        wallMs: init.wallMs,
        machines: init.machines.map((m) => ({
          name: m.name,
          status: m.status,
          durationMs: m.durationMs,
          ...(m.error ? { error: 'machine-init-failed' } : {}),
        })),
      }
    : null
  const machineFailure = machines.some((m) => m.status !== 'ok') || expectedMachines.some((name) => !machinesMap[name])
  const checks: WebsiteHealthSnapshot['checks'] = {
    config: {
      state: config.loaded ? 'success' : 'failure',
      reason: config.loaded ? 'config-loaded' : 'config-load-failed',
    },
    database: {
      state: required ? (connected ? 'success' : 'failure') : 'skipped',
      reason: required ? (connected ? 'database-connected' : 'database-unavailable') : 'database-not-configured',
    },
    machines: {
      state: machineFailure ? 'failure' : machines.length ? 'success' : 'skipped',
      reason: machineFailure ? 'required-machine-unavailable' : machines.length ? 'machines-ready' : 'no-machines',
    },
    migrations: {
      state: migrationsFailHealth(migrations) ? 'failure' : migrations.checked ? 'success' : 'skipped',
      reason: migrations.checked
        ? !migrations.migrationsTable
          ? 'ledger-unavailable'
          : migrations.ledgerAhead
            ? 'ledger-ahead'
            : migrations.pending
              ? 'migrations-pending'
              : 'counts-match'
        : migrations.reason === 'error'
          ? (migrations.error ?? 'migration-check-failed')
          : migrations.reason,
    },
  }
  const readinessReasons = Object.values(checks)
    .filter((c) => c.state === 'failure')
    .map((c) => c.reason)
  const ok = readinessReasons.length === 0

  const reconnect: DatabaseReconnectStatus =
    typeof website.getDatabaseReconnectStatus === 'function'
      ? website.getDatabaseReconnectStatus()
      : {
          reconnecting: false,
          attemptIndex: 0,
          nextAttemptAt: null,
          scheduleExhausted: false,
        }

  return {
    schemaVersion: 2,
    identity: website.buildMetadata?.identity ?? null,
    diagnostics: website.buildMetadata?.diagnostics ?? null,
    checks,
    readinessReasons,
    ok,
    website: website.name,
    checkedAt,
    config,
    db: {
      configured,
      required,
      connected,
      reconnecting: reconnect.reconnecting,
      attemptIndex: reconnect.attemptIndex,
      nextAttemptAt: reconnect.nextAttemptAt,
      scheduleExhausted: reconnect.scheduleExhausted,
    },
    migrations,
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

/** GET /version — public build/runtime metadata. */
export const version: Controller = (res, _req, website) => {
  try {
    endJson(res, 200, publicWebsiteVersion(website))
  } catch (error) {
    console.error(`Error in ${website.name}/version: ${error instanceof Error ? error.message : 'Unknown error'}`)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Internal Server Error')
    }
  }
}

/** GET /health — operator readiness; gated by THALIA_HEALTH_TOKEN. */
export const health: Controller = (res, req, website, _requestInfo: RequestInfo) => {
  void handleHealth(res, req, website)
}

async function handleHealth(res: ServerResponse, req: IncomingMessage, website: Website): Promise<void> {
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
    console.error(`Error in ${website.name}/health: ${error instanceof Error ? error.message : 'Unknown error'}`)
    endJson(res, 500, { error: 'Internal Server Error' })
  }
}

/** Explicit allowlist: never serialise the template/process version object publicly. */
export function publicWebsiteVersion(website: Website) {
  const identity = website.buildMetadata?.identity
  return {
    schemaVersion: 2,
    hostname: website.buildMetadata?.diagnostics.process.hostname ?? null,
    NODE_ENV: website.buildMetadata?.diagnostics.process.environment ?? null,
    identity: identity ?? null,
    websiteName: identity?.application.id ?? null,
    version: identity?.application.version ?? 'unknown',
    gitHash: identity?.application.revision ?? 'unknown',
    thaliaVersion: identity?.framework.version ?? 'unknown',
    thaliaGitHash: identity?.framework.revision ?? 'unknown',
  }
}
