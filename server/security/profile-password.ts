/**
 * Authenticated self-service password change.
 *
 * POST `/api/profile/password`
 *   `{ currentPassword, newPassword, confirmPassword }`
 *
 * Identity is taken only from the session (`requestInfo.userAuth.userId`).
 * Soft-revokes other sessions (keeps current); never hard-DELETEs sessions.
 */
import type { IncomingMessage, ServerResponse } from 'http'
import { eq } from 'drizzle-orm'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import type { Controller, Website } from '../website.js'
import type { RequestInfo } from '../server.js'
import { ThaliaSecurity } from './thalia-security.js'
import { assertSameOriginMutation } from './same-origin.js'
import { revokeOtherSessionsForUser } from './session-revoke.js'
import {
  clearAuthThrottle,
  createMemoryLoginThrottleRepository,
  loginThrottleKeyHash,
  loginThrottleRepositoryForWebsite,
  type LoginThrottleRepository,
} from './login-throttle.js'

export const PROFILE_PASSWORD_MIN_LEN = 8
export const PROFILE_PASSWORD_MAX_LEN = 1024
export const PROFILE_PASSWORD_MAX_BODY_BYTES = 8 * 1024
/** Audit action written on successful change. */
export const PROFILE_PASSWORD_AUDIT_ACTION = 'profile.password.change'

/** Machine-readable codes for password-change JSON errors (`{ error, code }`). */
export type ProfilePasswordJsonErrorCode =
  | 'UNAUTHORIZED'
  | 'METHOD_NOT_ALLOWED'
  | 'CSRF_ORIGIN'
  | 'DB_UNAVAILABLE'
  | 'BODY_TOO_LARGE'
  | 'BODY_READ_ERROR'
  | 'INVALID_JSON'
  | 'IDENTITY_NOT_ALLOWED'
  | 'CURRENT_PASSWORD_REQUIRED'
  | 'INVALID_PASSWORD_LENGTH'
  | 'PASSWORD_MISMATCH'
  | 'PASSWORD_UNCHANGED'
  | 'NOT_FOUND'
  | 'ACCOUNT_LOCKED'
  | 'CURRENT_PASSWORD_WRONG'
  | 'PASSWORD_CHANGE_FAILED'

export type ProfilePasswordApiDeps = {
  verifyPassword?: (password: string, hash: string) => Promise<boolean>
  hashPassword?: (password: string) => Promise<string>
  getThrottleRepository?: (website: Website) => LoginThrottleRepository | null | undefined
  writeAudit?: (args: {
    website: Website
    requestInfo: RequestInfo
    userId: number
  }) => Promise<void>
  assertSameOrigin?: typeof assertSameOriginMutation
  minPasswordLength?: number
  maxPasswordLength?: number
  maxBodyBytes?: number
}

function sendPasswordJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'private, no-store')
  res.end(JSON.stringify(payload))
}

function sendPasswordError(res: ServerResponse, status: number, error: string, code: ProfilePasswordJsonErrorCode): void {
  sendPasswordJson(res, status, { error, code })
}

type ReadBodyResult =
  | { ok: true; body: string }
  | { ok: false; status: number; error: string; code: ProfilePasswordJsonErrorCode }

function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<ReadBodyResult> {
  return new Promise((resolvePromise) => {
    let total = 0
    let settled = false
    const chunks: Buffer[] = []
    const finish = (result: ReadBodyResult): void => {
      if (settled) return
      settled = true
      cleanup()
      resolvePromise(result)
    }
    const onData = (chunk: Buffer | string): void => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
      total += buf.length
      if (total > maxBytes) {
        finish({ ok: false, status: 413, error: 'Request body too large', code: 'BODY_TOO_LARGE' })
        return
      }
      chunks.push(buf)
    }
    const onEnd = (): void => {
      finish({ ok: true, body: Buffer.concat(chunks).toString('utf8') })
    }
    const onError = (): void => {
      finish({ ok: false, status: 400, error: 'Could not read request body', code: 'BODY_READ_ERROR' })
    }
    const cleanup = (): void => {
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onError)
    }
    req.on('data', onData)
    req.on('end', onEnd)
    req.on('error', onError)
  })
}

async function defaultWriteAudit(args: {
  website: Website
  requestInfo: RequestInfo
  userId: number
}): Promise<void> {
  const drizzle = args.website.db?.drizzle
  const auditsTbl = args.website.db?.machines?.audits?.table as MySqlTableWithColumns<any> | undefined
  if (!drizzle || !auditsTbl) return
  try {
    await drizzle.insert(auditsTbl).values({
      userId: args.userId,
      action: PROFILE_PASSWORD_AUDIT_ACTION,
      ip: args.requestInfo.ip ?? 'unknown',
      sessionId: args.requestInfo.userAuth?.sessionId ?? null,
      blob: {
        userId: args.userId,
        sessionId: args.requestInfo.userAuth?.sessionId ?? null,
      },
    })
  } catch (err) {
    console.error('profile password audit write failed:', err)
  }
}

/**
 * Build the POST `/api/profile/password` controller.
 * Registered by default from {@link ThaliaSecurity.securityConfig}; use this export only for custom deps / tests.
 */
export function createProfilePasswordController(deps: ProfilePasswordApiDeps = {}): Controller {
  const verifyPassword = deps.verifyPassword ?? ((p, h) => ThaliaSecurity.verifyPassword(p, h))
  const hashPassword = deps.hashPassword ?? ((p) => ThaliaSecurity.hashPassword(p))
  const getThrottleRepository =
    deps.getThrottleRepository ??
    ((website: Website) =>
      loginThrottleRepositoryForWebsite(website) ?? createMemoryLoginThrottleRepository())
  const writeAudit = deps.writeAudit ?? defaultWriteAudit
  const checkOrigin = deps.assertSameOrigin ?? assertSameOriginMutation
  const minLen = deps.minPasswordLength ?? PROFILE_PASSWORD_MIN_LEN
  const maxLen = deps.maxPasswordLength ?? PROFILE_PASSWORD_MAX_LEN
  const maxBody = deps.maxBodyBytes ?? PROFILE_PASSWORD_MAX_BODY_BYTES

  return async (res, req, website, requestInfo) => {
    await handlePasswordChange(res, req, website, requestInfo)
  }

  async function handlePasswordChange(
    res: ServerResponse,
    req: IncomingMessage,
    website: Website,
    requestInfo: RequestInfo,
  ): Promise<void> {
    const userAuth = requestInfo.userAuth
    if (!userAuth || (userAuth.role !== 'user' && userAuth.role !== 'admin') || userAuth.userId == null) {
      sendPasswordError(res, 401, 'Unauthorized', 'UNAUTHORIZED')
      return
    }

    const method = (req.method ?? 'GET').toUpperCase()
    if (method !== 'POST') {
      sendPasswordError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
      return
    }

    if (!checkOrigin(req, requestInfo)) {
      sendPasswordError(res, 403, 'Forbidden', 'CSRF_ORIGIN')
      return
    }

    const drizzle = website.db?.drizzle
    const usersTable = website.db?.machines?.users?.table
    const sessionsTable = website.db?.machines?.sessions?.table
    if (!drizzle || !usersTable) {
      sendPasswordError(res, 503, 'Database unavailable', 'DB_UNAVAILABLE')
      return
    }

    const raw = await readJsonBody(req, maxBody)
    if (!raw.ok) {
      sendPasswordError(res, raw.status, raw.error, raw.code)
      return
    }

    let body: Record<string, unknown>
    try {
      const parsed: unknown = raw.body.trim() ? JSON.parse(raw.body) : {}
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        sendPasswordError(res, 400, 'Invalid JSON', 'INVALID_JSON')
        return
      }
      body = parsed as Record<string, unknown>
    } catch {
      sendPasswordError(res, 400, 'Invalid JSON', 'INVALID_JSON')
      return
    }

    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

    if (body.userId !== undefined || body.email !== undefined || body.username !== undefined) {
      sendPasswordError(
        res,
        400,
        'Do not send user identity in the password change body',
        'IDENTITY_NOT_ALLOWED',
      )
      return
    }

    if (!currentPassword) {
      sendPasswordError(res, 400, 'Current password is required', 'CURRENT_PASSWORD_REQUIRED')
      return
    }
    if (newPassword.length < minLen || newPassword.length > maxLen) {
      sendPasswordError(
        res,
        400,
        `New password must be between ${minLen} and ${maxLen} characters`,
        'INVALID_PASSWORD_LENGTH',
      )
      return
    }
    if (newPassword !== confirmPassword) {
      sendPasswordError(res, 400, 'New passwords do not match', 'PASSWORD_MISMATCH')
      return
    }
    if (newPassword === currentPassword) {
      sendPasswordError(
        res,
        400,
        'New password must be different from the current password',
        'PASSWORD_UNCHANGED',
      )
      return
    }

    try {
      const rows = await drizzle
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userAuth.userId))
        .limit(1)
      const user = rows[0] as { id: number; password: string; locked?: boolean } | undefined
      if (!user) {
        sendPasswordError(res, 404, 'User not found', 'NOT_FOUND')
        return
      }
      if (user.locked) {
        sendPasswordError(res, 403, 'Account is locked', 'ACCOUNT_LOCKED')
        return
      }

      const valid = await verifyPassword(currentPassword, user.password)
      if (!valid) {
        sendPasswordError(res, 403, 'Current password is incorrect', 'CURRENT_PASSWORD_WRONG')
        return
      }

      const passwordHash = await hashPassword(newPassword)
      await drizzle
        .update(usersTable)
        .set({
          password: passwordHash,
          verified: true,
          passwordResetToken: null,
          passwordResetExpires: null,
        })
        .where(eq(usersTable.id, user.id))

      let otherSessionsRevoked = false
      if (sessionsTable) {
        try {
          await revokeOtherSessionsForUser(drizzle, sessionsTable, user.id, userAuth.sessionId)
          otherSessionsRevoked = true
        } catch (err) {
          console.error('profile password: other-session revoke failed (password already updated):', err)
        }
      }

      try {
        const ip = typeof requestInfo.ip === 'string' ? requestInfo.ip : ''
        if (ip) {
          const repo = getThrottleRepository(website)
          if (repo) await repo.clear(loginThrottleKeyHash(ip))
          else await clearAuthThrottle(website, ip, 'logon')
        }
      } catch {
        // throttle table optional
      }

      await writeAudit({ website, requestInfo, userId: user.id })

      sendPasswordJson(res, 200, { ok: true, otherSessionsRevoked })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('profile password change failed:', err)
      sendPasswordError(res, 500, message, 'PASSWORD_CHANGE_FAILED')
    }
  }
}

/** Nested controller tree for `recursiveObjectMerge` into site `controllers`. */
export function profilePasswordControllerTree(controller: Controller = createProfilePasswordController()): {
  api: { profile: { password: Controller } }
} {
  return { api: { profile: { password: controller } } }
}
