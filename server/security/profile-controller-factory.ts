import type { IncomingMessage, ServerResponse } from 'http'
import { eq, sql } from 'drizzle-orm'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import type { Controller, Website } from '../website.js'
import type { Machine } from '../types.js'
import type { RequestInfo } from '../server.js'
import { users as defaultUsersTable, type User } from '../../models/security-models.js'

const DEFAULT_CONTENT_TEMPLATE = 'profile_content'
const DEFAULT_MAX_JSON_BYTES = 64 * 1024
const DEFAULT_MAX_STRING_FIELD_LENGTH = 4096
const DEFAULT_UPDATABLE_FIELDS = ['name', 'photo'] as const

/** Machine-readable reason on JSON error bodies (`{ error, code }`). */
export type ProfileJsonErrorCode =
  | 'BODY_TOO_LARGE'
  | 'BODY_READ_ERROR'
  | 'FIELD_NOT_STRING'
  | 'FIELD_NULL_INVALID'
  | 'FIELD_TOO_LONG'
  | 'INVALID_JSON'
  | 'JSON_NOT_OBJECT'
  | 'NAME_EMPTY'
  | 'NO_FIELDS_TO_UPDATE'
  | 'PHOTO_VALUE_REJECTED'
  | 'PROFILE_FORBIDDEN'
  | 'PROFILE_ID_REQUIRED'
  | 'PROFILE_UPDATE_FAILED'
  | 'UNKNOWN_FIELD'

export type ProfileJsonErrorBody = {
  error: string
  code: ProfileJsonErrorCode
}

export function profileJsonErrorBody(error: string, code: ProfileJsonErrorCode): ProfileJsonErrorBody {
  return { error, code }
}

export function profileJsonErrorString(error: string, code: ProfileJsonErrorCode): string {
  return JSON.stringify(profileJsonErrorBody(error, code))
}

export type ProfileReadScope = 'authenticated' | 'owner_or_admin'

/**
 * Who may see the real **`email`** on GET profile HTML.
 * **`everyone`** (default): any reader allowed by {@link ProfileControllerFactoryOptions.profileReadScope} sees **`email`**.
 * **`owner_or_admin_only`**: others get an empty **`email`** in locals and **`profileEmailRedacted`** in the template (SQL uses a literal instead of the column when masked).
 */
export type ProfileEmailVisibility = 'everyone' | 'owner_or_admin_only'

/**
 * Whether GET profile should expose the real **`email`** (vs masked for template + SQL projection).
 */
export function profileRevealEmailForGet(
  visibility: ProfileEmailVisibility,
  profileUserId: number,
  viewerUserId: number | undefined,
  viewerRole: string | undefined,
): boolean {
  if (visibility === 'everyone') return true
  if (viewerRole === 'admin') return true
  return viewerUserId !== undefined && String(viewerUserId) === String(profileUserId)
}

/** Result of optional {@link ProfileControllerFactoryOptions.validatePhoto} (after JSON parse + trim). */
export type ProfilePhotoValidationResult =
  | { ok: true }
  | { ok: false; error: string; code?: ProfileJsonErrorCode }

/**
 * Stock validator: allow **`null`** (clear photo); non-null values must be absolute **`http:`** or **`https:`** URLs.
 * Use with **`ProfileControllerFactoryOptions.validatePhoto`**.
 */
export function validateProfilePhotoHttpHttpsUrl(value: string | null): ProfilePhotoValidationResult {
  if (value === null) return { ok: true }
  try {
    const u = new URL(value)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return {
        ok: false,
        error: 'photo URL must use http or https',
        code: 'PHOTO_VALUE_REJECTED',
      }
    }
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: 'photo must be a valid http(s) URL',
      code: 'PHOTO_VALUE_REJECTED',
    }
  }
}

export interface ProfileControllerFactoryOptions {
  /** Handlebars content template name (default `profile_content`). */
  contentTemplate?: string
  /**
   * When true (default), GET `/profile` (no id segment) redirects to `/profile/<currentUserId>` if the viewer has a session user id.
   * Non-numeric segments (e.g. `/profile/foo`) still return **400**.
   */
  profileIndexRedirect?: boolean
  /**
   * `authenticated`: any signed-in user allowed by route rules may GET a profile by id.
   * `owner_or_admin`: only the profile owner or `admin` may GET.
   */
  profileReadScope?: ProfileReadScope
  /** Who may see **`email`** on GET (default **`everyone`**). */
  profileEmailVisibility?: ProfileEmailVisibility
  /** Whitelist of `users` columns this JSON handler may update (default `name` + `photo`). */
  updatableFields?: readonly ('name' | 'photo')[]
  /** Max raw JSON body bytes for PATCH/POST (default 64 KiB). */
  maxJsonBytes?: number
  /** Max trimmed string length for `name` / `photo` (default 4096). */
  maxStringFieldLength?: number
  /**
   * If set, run after a successful JSON parse when the patch includes **`photo`** (including **`null`** to clear).
   * Return **`{ ok: false, error }`** for **422**; optional **`code`** defaults to **`PHOTO_VALUE_REJECTED`**.
   * See **`validateProfilePhotoHttpHttpsUrl`** for a common **`http`/`https`**-only check.
   */
  validatePhoto?: (value: string | null) => ProfilePhotoValidationResult
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
  /** True when email exists but is withheld from this viewer (see {@link ProfileEmailVisibility}). */
  profileEmailRedacted: boolean
}

type ResolvedOptions = {
  contentTemplate: string
  profileIndexRedirect: boolean
  profileReadScope: ProfileReadScope
  profileEmailVisibility: ProfileEmailVisibility
  updatableFields: readonly ('name' | 'photo')[]
  maxJsonBytes: number
  maxStringFieldLength: number
  validatePhoto?: ProfileControllerFactoryOptions['validatePhoto']
  buildViewModel?: ProfileControllerFactoryOptions['buildViewModel']
  pageTitlePrefix: string
  buildPageDescription: (displayName: string) => string
}

/**
 * GET `/profile` with no id: return `/profile/<userId>` when redirect is enabled and **`userId`** is set; otherwise **null**.
 * Does not apply when **`rawAction`** is non-empty (e.g. invalid `/profile/foo` — caller should **400**).
 */
export function profileSelfRedirectLocation(
  rawAction: string,
  userId: number | undefined,
  profileIndexRedirect: boolean,
): string | null {
  if (!profileIndexRedirect) return null
  if (rawAction.trim() !== '') return null
  if (userId === undefined) return null
  return `/profile/${userId}`
}

function resolveOptions(options?: ProfileControllerFactoryOptions): ResolvedOptions {
  return {
    contentTemplate: options?.contentTemplate ?? DEFAULT_CONTENT_TEMPLATE,
    profileIndexRedirect: options?.profileIndexRedirect ?? true,
    profileReadScope: options?.profileReadScope ?? 'authenticated',
    profileEmailVisibility: options?.profileEmailVisibility ?? 'everyone',
    updatableFields: options?.updatableFields?.length ? options.updatableFields : [...DEFAULT_UPDATABLE_FIELDS],
    maxJsonBytes: options?.maxJsonBytes ?? DEFAULT_MAX_JSON_BYTES,
    maxStringFieldLength: options?.maxStringFieldLength ?? DEFAULT_MAX_STRING_FIELD_LENGTH,
    validatePhoto: options?.validatePhoto,
    buildViewModel: options?.buildViewModel,
    pageTitlePrefix: options?.pageTitlePrefix ?? 'Profile —',
    buildPageDescription: options?.buildPageDescription ?? ((displayName: string) => `Account profile for ${displayName}.`),
  }
}

/**
 * Validates a parsed JSON object for profile PATCH/POST.
 * **400**: not a plain object. **422**: unknown keys, wrong types, empty patch, invalid strings.
 * On failure, **`code`** is a stable {@link ProfileJsonErrorCode} for API clients.
 */
export function parseProfileUpdatePayload(
  parsed: unknown,
  updatableFields: readonly ('name' | 'photo')[],
  maxStringFieldLength: number,
):
  | { ok: true; patch: Record<string, string | null> }
  | { ok: false; status: 400 | 422; error: string; code: ProfileJsonErrorCode } {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: 'JSON body must be an object', code: 'JSON_NOT_OBJECT' }
  }
  const body = parsed as Record<string, unknown>
  const keys = Object.keys(body)
  const allowed = new Set<string>(updatableFields)
  for (const k of keys) {
    if (!allowed.has(k)) {
      return { ok: false, status: 422, error: `Unknown or disallowed field: ${k}`, code: 'UNKNOWN_FIELD' }
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
      return { ok: false, status: 422, error: `Invalid value for ${field}`, code: 'FIELD_NULL_INVALID' }
    }
    if (typeof raw !== 'string') {
      return { ok: false, status: 422, error: `${field} must be a string`, code: 'FIELD_NOT_STRING' }
    }
    const trimmed = raw.trim()
    if (trimmed.length > maxStringFieldLength) {
      return { ok: false, status: 422, error: `${field} is too long`, code: 'FIELD_TOO_LONG' }
    }
    if (field === 'name') {
      if (trimmed.length === 0) {
        return { ok: false, status: 422, error: 'name must be non-empty', code: 'NAME_EMPTY' }
      }
      patch[field] = trimmed
      continue
    }
    // photo
    patch[field] = trimmed.length === 0 ? null : trimmed
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, status: 422, error: 'No valid fields to update', code: 'NO_FIELDS_TO_UPDATE' }
  }
  return { ok: true, patch }
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type ReadJsonBodyResult =
  | { ok: true; body: string }
  | { ok: false; status: 400; error: string; code: ProfileJsonErrorCode }

function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<ReadJsonBodyResult> {
  return new Promise((resolvePromise) => {
    let total = 0
    let settled = false
    const chunks: Buffer[] = []
    const finish = (result: ReadJsonBodyResult): void => {
      if (settled) return
      settled = true
      cleanup()
      resolvePromise(result)
    }
    const onData = (chunk: Buffer | string): void => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
      total += buf.length
      if (total > maxBytes) {
        finish({ ok: false, status: 400, error: 'Request body too large', code: 'BODY_TOO_LARGE' })
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
    const rawAction = (requestInfo.action ?? '').trim()
    const id = rawAction === '' ? NaN : parseInt(rawAction, 10)
    const hasValidNumericId = rawAction !== '' && Number.isFinite(id)
    const userAuth = requestInfo.userAuth

    if (!website.db) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end('<h1>Service Unavailable</h1><p>Database not configured.</p>')
      return
    }

    const usersTable = website.db.machines.users.table

    if (req.method === 'GET') {
      if (!hasValidNumericId) {
        if (rawAction !== '') {
          res.statusCode = 400
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end('<h1>Bad Request</h1><p>Invalid profile ID.</p>')
          return
        }
        const redirectTo = profileSelfRedirectLocation(
          rawAction,
          userAuth?.userId,
          this.resolved.profileIndexRedirect,
        )
        if (redirectTo) {
          res.statusCode = 302
          res.setHeader('Location', redirectTo)
          res.end()
          return
        }
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
        const revealEmail = profileRevealEmailForGet(
          this.resolved.profileEmailVisibility,
          id,
          userAuth?.userId,
          userAuth?.role,
        )
        const rows = await website.db.drizzle
          .select({
            id: usersTable.id,
            name: usersTable.name,
            email: revealEmail ? usersTable.email : sql<string>`''`.mapWith(String),
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
        const profileEmailRedacted = this.resolved.profileEmailVisibility === 'owner_or_admin_only' && !revealEmail
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
          profileEmailRedacted,
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
          profileEmailRedacted,
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
      if (!hasValidNumericId) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(profileJsonErrorString('Profile ID required', 'PROFILE_ID_REQUIRED'))
        return
      }
      if (!this.canWriteProfile(website, requestInfo, id)) {
        res.statusCode = 403
        res.setHeader('Content-Type', 'application/json')
        res.end(
          profileJsonErrorString('Forbidden: only owner or admin can edit this profile', 'PROFILE_FORBIDDEN'),
        )
        return
      }

      const raw = await readJsonBody(req, this.resolved.maxJsonBytes)
      if (!raw.ok) {
        res.statusCode = raw.status
        res.setHeader('Content-Type', 'application/json')
        res.end(profileJsonErrorString(raw.error, raw.code))
        return
      }
      let parsed: unknown
      try {
        parsed = raw.body.length ? JSON.parse(raw.body) : {}
      } catch {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(profileJsonErrorString('Invalid JSON', 'INVALID_JSON'))
        return
      }
      const fields = this.resolved.updatableFields as ('name' | 'photo')[]
      const parsedResult = parseProfileUpdatePayload(parsed, fields, this.resolved.maxStringFieldLength)
      if (!parsedResult.ok) {
        res.statusCode = parsedResult.status
        res.setHeader('Content-Type', 'application/json')
        res.end(profileJsonErrorString(parsedResult.error, parsedResult.code))
        return
      }
      if (this.resolved.validatePhoto && 'photo' in parsedResult.patch) {
        const photoVal = parsedResult.patch.photo as string | null
        const vr = this.resolved.validatePhoto(photoVal)
        if (!vr.ok) {
          res.statusCode = 422
          res.setHeader('Content-Type', 'application/json')
          res.end(profileJsonErrorString(vr.error, vr.code ?? 'PHOTO_VALUE_REJECTED'))
          return
        }
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
        res.end(profileJsonErrorString(msg, 'PROFILE_UPDATE_FAILED'))
      }
      return
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end('<h1>Method Not Allowed</h1>')
  }
}
