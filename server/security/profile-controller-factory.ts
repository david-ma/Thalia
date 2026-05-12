import type { IncomingMessage, ServerResponse } from 'http'
import { eq } from 'drizzle-orm'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import type { Controller, Website } from '../website.js'
import type { Machine } from '../types.js'
import type { RequestInfo } from '../server.js'
import { users as defaultUsersTable, type User } from '../../models/security-models.js'

const DEFAULT_CONTENT_TEMPLATE = 'profile_content'
const DEFAULT_MAX_JSON_BYTES = 64 * 1024
const DEFAULT_MAX_STRING_FIELD_LENGTH = 4096
const DEFAULT_UPDATABLE_FIELDS = ['name', 'photo'] as const

export type ProfileReadScope = 'authenticated' | 'owner_or_admin'

export interface ProfileControllerFactoryOptions {
  /** Handlebars content template name (default `profile_content`). */
  contentTemplate?: string
  /**
   * `authenticated`: any signed-in user allowed by route rules may GET a profile by id.
   * `owner_or_admin`: only the profile owner or `admin` may GET.
   */
  profileReadScope?: ProfileReadScope
  /** Whitelist of `users` columns this JSON handler may update (default `name` + `photo`). */
  updatableFields?: readonly ('name' | 'photo')[]
  /** Max raw JSON body bytes for PATCH/POST (default 64 KiB). */
  maxJsonBytes?: number
  /** Max trimmed string length for `name` / `photo` (default 4096). */
  maxStringFieldLength?: number
  /** Optional override for template locals on GET (receives base locals + row). */
  buildViewModel?: (input: ProfileViewModelInput) => Record<string, unknown>
  /** Prefix for HTML `<title>` (default `Profile —`). */
  pageTitlePrefix?: string
  /** Meta description; default uses display name. */
  buildPageDescription?: (displayName: string) => string
}

export type ProfileViewModelInput = {
  row: Pick<User, 'id' | 'name' | 'email' | 'photo' | 'role'>
  profileName: string
  profileEmail: string
  profilePhoto: string
  profileDisplayName: string
  profileRole: string
  profileInitial: string
  canEdit: boolean
  isOwnProfile: boolean
  viewerIsAdmin: boolean
}

type ResolvedOptions = {
  contentTemplate: string
  profileReadScope: ProfileReadScope
  updatableFields: readonly ('name' | 'photo')[]
  maxJsonBytes: number
  maxStringFieldLength: number
  buildViewModel?: ProfileControllerFactoryOptions['buildViewModel']
  pageTitlePrefix: string
  buildPageDescription: (displayName: string) => string
}

function resolveOptions(options?: ProfileControllerFactoryOptions): ResolvedOptions {
  return {
    contentTemplate: options?.contentTemplate ?? DEFAULT_CONTENT_TEMPLATE,
    profileReadScope: options?.profileReadScope ?? 'authenticated',
    updatableFields: options?.updatableFields?.length ? options.updatableFields : [...DEFAULT_UPDATABLE_FIELDS],
    maxJsonBytes: options?.maxJsonBytes ?? DEFAULT_MAX_JSON_BYTES,
    maxStringFieldLength: options?.maxStringFieldLength ?? DEFAULT_MAX_STRING_FIELD_LENGTH,
    buildViewModel: options?.buildViewModel,
    pageTitlePrefix: options?.pageTitlePrefix ?? 'Profile —',
    buildPageDescription: options?.buildPageDescription ?? ((displayName: string) => `Account profile for ${displayName}.`),
  }
}

/**
 * Validates a parsed JSON object for profile PATCH/POST.
 * **400**: not a plain object. **422**: unknown keys, wrong types, empty patch, invalid strings.
 */
export function parseProfileUpdatePayload(
  parsed: unknown,
  updatableFields: readonly ('name' | 'photo')[],
  maxStringFieldLength: number,
): { ok: true; patch: Record<string, string | null> } | { ok: false; status: 400 | 422; error: string } {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: 'JSON body must be an object' }
  }
  const body = parsed as Record<string, unknown>
  const keys = Object.keys(body)
  const allowed = new Set<string>(updatableFields)
  for (const k of keys) {
    if (!allowed.has(k)) {
      return { ok: false, status: 422, error: `Unknown or disallowed field: ${k}` }
    }
  }
  const patch: Record<string, string | null> = {}
  for (const field of updatableFields) {
    if (!(field in body)) continue
    const raw = body[field]
    if (raw === null) {
      if (field === 'photo') {
        patch[field] = null
        continue
      }
      return { ok: false, status: 422, error: `Invalid value for ${field}` }
    }
    if (typeof raw !== 'string') {
      return { ok: false, status: 422, error: `${field} must be a string` }
    }
    const trimmed = raw.trim()
    if (trimmed.length > maxStringFieldLength) {
      return { ok: false, status: 422, error: `${field} is too long` }
    }
    if (field === 'name') {
      if (trimmed.length === 0) {
        return { ok: false, status: 422, error: 'name must be non-empty' }
      }
      patch[field] = trimmed
      continue
    }
    // photo
    patch[field] = trimmed.length === 0 ? null : trimmed
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, status: 422, error: 'No valid fields to update' }
  }
  return { ok: true, patch }
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<{ ok: true; body: string } | { ok: false; status: 400; error: string }> {
  return new Promise((resolvePromise) => {
    let total = 0
    let settled = false
    const chunks: Buffer[] = []
    const finish = (result: { ok: true; body: string } | { ok: false; status: 400; error: string }): void => {
      if (settled) return
      settled = true
      cleanup()
      resolvePromise(result)
    }
    const onData = (chunk: Buffer | string): void => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
      total += buf.length
      if (total > maxBytes) {
        finish({ ok: false, status: 400, error: 'Request body too large' })
        return
      }
      chunks.push(buf)
    }
    const onEnd = (): void => {
      finish({ ok: true, body: Buffer.concat(chunks).toString('utf8') })
    }
    const onError = (): void => {
      finish({ ok: false, status: 400, error: 'Could not read request body' })
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

/**
 * `Machine` that serves a user profile page (GET) and JSON updates (PUT/PATCH/POST) for whitelisted `users` columns.
 * Row-level write auth: **owner** or **admin**. Coarse route rules stay in {@link RoleRouteRule}.
 *
 * Prefer a **site** Handlebars partial (e.g. `websites/.../src/partials/profile_content.hbs`). The framework file
 * **`src/views/security/profile.hbs`** is a legacy demo scaffold, not wired to this factory.
 */
export class ProfileControllerFactory implements Machine {
  public table: MySqlTableWithColumns<any> = defaultUsersTable as MySqlTableWithColumns<any>
  public name!: string
  private readonly resolved: ResolvedOptions

  constructor(options?: ProfileControllerFactoryOptions) {
    this.resolved = resolveOptions(options)
  }

  public init(website: Website, name: string): void {
    this.name = name
    if (website.db?.machines?.users?.table) {
      this.table = website.db.machines.users.table
    }
  }

  /** Subclasses may override to tighten or loosen read access (default uses {@link ProfileControllerFactoryOptions.profileReadScope}). */
  protected canReadProfile(_website: Website, requestInfo: RequestInfo, profileId: number): boolean {
    const auth = requestInfo.userAuth
    if (this.resolved.profileReadScope === 'authenticated') {
      return auth?.userId !== undefined || auth?.role === 'admin'
    }
    const isOwner = auth?.userId !== undefined && String(auth.userId) === String(profileId)
    const isAdmin = auth?.role === 'admin'
    return isOwner || isAdmin
  }

  /** Subclasses may override; default: owner or admin may write. */
  protected canWriteProfile(_website: Website, requestInfo: RequestInfo, profileId: number): boolean {
    const auth = requestInfo.userAuth
    const isOwner = auth?.userId !== undefined && String(auth.userId) === String(profileId)
    const isAdmin = auth?.role === 'admin'
    return isOwner || isAdmin
  }

  public controller: Controller = (res, req, website, requestInfo) => {
    void this.handle(res, req, website, requestInfo)
  }

  private async handle(
    res: ServerResponse,
    req: IncomingMessage,
    website: Website,
    requestInfo: RequestInfo,
  ): Promise<void> {
    const userIdParam = requestInfo.action || ''
    const id = parseInt(userIdParam, 10)
    const userAuth = requestInfo.userAuth

    if (!website.db) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end('<h1>Service Unavailable</h1><p>Database not configured.</p>')
      return
    }

    const usersTable = website.db.machines.users.table

    if (req.method === 'GET') {
      if (!Number.isFinite(id)) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end('<h1>Bad Request</h1><p>Profile ID required.</p>')
        return
      }
      if (!this.canReadProfile(website, requestInfo, id)) {
        res.statusCode = 403
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end('<h1>Forbidden</h1><p>You cannot view this profile.</p>')
        return
      }
      try {
        const rows = await website.db.drizzle
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
            photo: usersTable.photo,
            role: usersTable.role,
          })
          .from(usersTable)
          .where(eq(usersTable.id, id))
          .limit(1)
        const user = rows[0] as Pick<User, 'id' | 'name' | 'email' | 'photo' | 'role'> | undefined
        if (!user) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end('<h1>Not Found</h1><p>Profile not found.</p>')
          return
        }
        const isOwner = userAuth?.userId !== undefined && String(userAuth.userId) === String(user.id)
        const isAdmin = userAuth?.role === 'admin'
        const canEdit = isOwner || isAdmin
        const profileName = user.name ?? ''
        const profileEmail = user.email ?? ''
        const profilePhoto = (user.photo && String(user.photo).trim()) || ''
        const profileInitialRaw =
          (profileName.trim()[0] ?? '') || (profileEmail.trim()[0] ?? '') || '?'
        const profileInitial = profileInitialRaw.toUpperCase()
        const profileDisplayName = profileName.trim() || profileEmail || `User ${user.id}`
        const profileRole = user.role ?? 'user'
        const baseLocals: ProfileViewModelInput = {
          row: user,
          profileName,
          profileEmail,
          profilePhoto,
          profileDisplayName,
          profileRole,
          profileInitial,
          canEdit,
          isOwnProfile: isOwner,
          viewerIsAdmin: !!isAdmin,
        }
        const extra = this.resolved.buildViewModel?.(baseLocals) ?? {}
        const html = website.getContentHtml(this.resolved.contentTemplate)({
          title: `${this.resolved.pageTitlePrefix} ${profileDisplayName}`,
          description: this.resolved.buildPageDescription(profileDisplayName),
          profileId: user.id,
          profileName,
          profileDisplayName,
          profileEmail,
          profileRole,
          profilePhoto,
          profileInitial,
          canEdit,
          isOwnProfile: isOwner,
          viewerIsAdmin: !!isAdmin,
          ...extra,
        })
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(html)
      } catch (err: unknown) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        const msg = err instanceof Error ? err.message : String(err)
        res.end(`<h1>Error</h1><p>${escapeHtmlText(msg)}</p>`)
      }
      return
    }

    if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'POST') {
      if (!Number.isFinite(id)) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Profile ID required' }))
        return
      }
      if (!this.canWriteProfile(website, requestInfo, id)) {
        res.statusCode = 403
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Forbidden: only owner or admin can edit this profile' }))
        return
      }

      const raw = await readJsonBody(req, this.resolved.maxJsonBytes)
      if (!raw.ok) {
        res.statusCode = raw.status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: raw.error }))
        return
      }
      let parsed: unknown
      try {
        parsed = raw.body.length ? JSON.parse(raw.body) : {}
      } catch {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
        return
      }
      const fields = this.resolved.updatableFields as ('name' | 'photo')[]
      const parsedResult = parseProfileUpdatePayload(parsed, fields, this.resolved.maxStringFieldLength)
      if (!parsedResult.ok) {
        res.statusCode = parsedResult.status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: parsedResult.error }))
        return
      }
      try {
        await website.db.drizzle.update(usersTable).set(parsedResult.patch).where(eq(usersTable.id, id))
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, id }))
      } catch (err: unknown) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        const msg = err instanceof Error ? err.message : String(err)
        res.end(JSON.stringify({ error: msg }))
      }
      return
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<h1>Method Not Allowed</h1>')
  }
}
