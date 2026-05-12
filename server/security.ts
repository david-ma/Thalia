import { ServerResponse, IncomingMessage } from 'http'
import { Controller, NestedControllerMap, Website } from './website'
import { CrudFactory, Machine } from './controllers'
import bcrypt from 'bcryptjs'

/*
This is the Thalia role based security system.

Thalia will have a few different levels of RouteGuard.
With zero config provided, it won't do any route guarding at all and just let all requests through.
At BasicRouteGuard, it can take a hard-coded password, simple path, and/or proxy target. And it is happy to take any mix of these.

This file is for the role based security system.
We will provide a simple interface that webmasters can import into their config.ts file.

This will then import the 3 required models: Users, Sessions, and Audits.
Roles are hardcoded to just admin, user, and guest.

When activating this module we also provide controllers which will handle the CRUD operations for the 3 models.
And set the permissions on these models based on the role of the user.

Our schema will be modelled on django security, for easy migration.

*/

import { MailService, mailTable } from './mail'

import { Permission, Role, SecurityConfig } from './route-guard'
export type { SecurityConfig }

import { users, sessions, audits, type User } from '../models/security-models'
import { RawWebsiteConfig, RouteRule, ThaliaAuthOptions } from './types'

const UserMachine: Machine = new CrudFactory(users, {
  relationships: [
    {
      foreignTable: 'sessions',
      foreignColumn: 'userId',
      localColumn: 'id',
    },
  ],
})

const SessionMachine: Machine = new CrudFactory(sessions, {
  relationships: [
    {
      foreignTable: 'users',
      foreignColumn: 'id',
      localColumn: 'userId',
    },
  ],
})

const AuditMachine: Machine = new CrudFactory(audits, {
  relationships: [
    {
      foreignTable: 'users',
      foreignColumn: 'id',
      localColumn: 'userId',
    },
    {
      foreignTable: 'sessions',
      foreignColumn: 'sid',
      localColumn: 'sessionId',
    },
  ],
})

export interface RoleRouteRule extends RouteRule {
  path: string
  permissions: Partial<Record<Role, Permission[]>>
  // For user-specific permissions
  // ownerOnly?: string[] // Actions only the owner can perform
  // Hardcode "owner: userId" to objects that can be owned?
}

const ALL_PERMISSIONS: Permission[] = ['create', 'read', 'update', 'delete']
const ALL_ROLES: Role[] = ['admin', 'user', 'guest']
// special role, "owner" is used for user-specific permissions

/** Default cookie + DB session lifetime when `config.thaliaAuth.sessionMaxAgeSeconds` is unset */
export const DEFAULT_THALIA_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export function sessionMaxAgeSecondsForWebsite(website: Website): number {
  return website.config.thaliaAuth?.sessionMaxAgeSeconds ?? DEFAULT_THALIA_SESSION_MAX_AGE_SECONDS
}

function cookieIsSecureHttps(req: IncomingMessage, website: Website): boolean {
  const xf = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim()
  return xf === 'https' || (website.env === 'production' && xf !== 'http')
}

function buildSessionCookieValue(
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

function buildClearedSessionCookie(req: IncomingMessage, website: Website): string {
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

function sendAuthHtml(res: ServerResponse, website: Website, view: string, data: Record<string, unknown> = {}): void {
  if (!res.headersSent) {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
  }
  res.end(website.getContentHtml(view)(data))
}

function requireDbConnection(res: ServerResponse, website: Website): boolean {
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

const default_routes: RoleRouteRule[] = [
  {
    path: '/admin',
    permissions: {
      admin: ALL_PERMISSIONS,
    },
  },
  {
    /** Aligns with the `users` CRUD controller path (`/users/...`). */
    path: '/users',
    permissions: {
      admin: ALL_PERMISSIONS,
      // owner: ['view', 'edit', 'delete'],
      user: ['read'],
    },
  },
  {
    path: '/sessions',
    permissions: {
      admin: ALL_PERMISSIONS,
    },
  },
  {
    path: '/audits',
    permissions: {
      admin: ALL_PERMISSIONS,
    },
  },
]

import { RequestInfo } from './server'
import { parseForm } from './util.js'
import { and, eq, gt } from 'drizzle-orm'
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
// import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'

import crypto from 'crypto'

import { drizzle } from 'drizzle-orm/mysql2'
import { MySql2Database } from 'drizzle-orm/mysql2'

export type UserDetails = {
  email: string
  password: string
  name: string
  role: string
  locked: boolean
  verified: boolean
}

export class SecurityService {
  public website!: Website
  public db!: MySql2Database

  constructor(drizzleConfig: any) {
    this.db = drizzle(drizzleConfig.default.dbCredentials.url)
  }

  public createUser(user: UserDetails) {
    return bcrypt.hash(user.password, 10).then((hashedPassword) => {
      user.password = hashedPassword
      return this.db
        .insert(users)
        .values(user)
        .$returningId()
        .catch((error) => {
          console.error('Error creating user ' + user.email)
          return null
        })
    })
  }
}

/**
 * Security Factory, imported to config.ts and used to create the security config which can be recursively merged with the website config.
 */
export type ThaliaSecurityConstructorOptions = ThaliaAuthOptions & {
  mailAuthPath?: string
}

export class ThaliaSecurity implements Machine {
  public table!: MySqlTableWithColumns<any>
  private mailService: MailService
  private website!: Website
  private readonly securityCtorOptions: ThaliaSecurityConstructorOptions

  constructor(options: ThaliaSecurityConstructorOptions = {}) {
    this.securityCtorOptions = options
    this.mailService = new MailService(options.mailAuthPath ?? '')
  }

  /** Defaults merged onto `Website.config.thaliaAuth` unless overridden in `config.ts`. */
  public defaultThaliaAuthOptions(): ThaliaAuthOptions {
    return {
      disableSelfRegistration: this.securityCtorOptions.disableSelfRegistration ?? false,
      sessionMaxAgeSeconds: this.securityCtorOptions.sessionMaxAgeSeconds ?? DEFAULT_THALIA_SESSION_MAX_AGE_SECONDS,
    }
  }

  public init(website: Website, name: string) {
    this.website = website
  }

  public controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void {
    console.debug('ThaliaSecurity controller')
  }

  public static hashPassword(password: string): Promise<string> {
    // Use bcrypt with 10 rounds (same as Laravel default)
    return bcrypt.hash(password, 10)
  }

  public static verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  private logonController(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void {
    if (!requireDbConnection(res, website)) return

    const drizzle = website.db!.drizzle
    const usersTable = website.db!.machines.users.table

    const method = requestInfo.method
    if (method === 'GET') {
      const message = requestInfo.query?.message
      sendAuthHtml(
        res,
        website,
        'userLogin',
        message ? { message: typeof message === 'string' ? decodeURIComponent(message.replace(/\+/g, ' ')) : '' } : {},
      )
    } else if (method === 'POST') {
      parseForm(res, req).then((form) => {
        console.debug('Login attempt:', form)
        if (!form.fields.Email || !form.fields.Password) {
          console.debug('Email and password are required')
          sendAuthHtml(res, website, 'userLogin', { error: 'Email and password are required' })
          return
        }

        drizzle
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, form.fields.Email))
          .then((rows) => {
            const user = rows[0] as User | undefined
            if (!user) {
              sendAuthHtml(res, website, 'userLogin', { error: 'Invalid email or password' })
              return
            }

            return ThaliaSecurity.verifyPassword(form.fields.Password, user.password).then((isValidPassword) => {
              if (!isValidPassword) {
                sendAuthHtml(res, website, 'userLogin', { error: 'Invalid email or password' })
                return null
              }

              if (user.locked) {
                sendAuthHtml(res, website, 'userLogin', { error: 'Account is locked' })
                return null
              }

              return user
            })
          })
          .then((user: User | null | undefined) => {
            if (!user) return

            const sessionTable = website.db.machines.sessions.table
            const sessionId = crypto.randomBytes(16).toString('hex')
            const maxAge = sessionMaxAgeSecondsForWebsite(website)
            const expiresAt = new Date(Date.now() + maxAge * 1000)
            return drizzle
              .insert(sessionTable)
              .values({
                sid: sessionId,
                userId: user.id,
                expires: expiresAt,
              })
              .then(() => {
                if (!res.headersSent) {
                  res.setHeader('Set-Cookie', buildSessionCookieValue(sessionId, maxAge, req, website))
                }
                res.writeHead(302, { Location: '/' })
                res.end()
              })
          })
          .catch((error: unknown) => {
            console.error('Error logging in:', error)
            sendAuthHtml(res, website, 'userLogin', { error: 'An error occurred' })
          })
      })
    } else {
      res.statusCode = 405
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Method not allowed')
    }
  }

  /** Clear server session + expiry cookie (`/` path). Alias: `logoff`. */
  private logoutController(
    res: ServerResponse,
    req: IncomingMessage,
    website: Website,
    requestInfo: RequestInfo,
  ): void {
    const sid = requestInfo.cookies?.sessionId
    const sessionsTbl = website.db?.machines?.sessions?.table
    const finish = (): void => {
      if (!res.headersSent) {
        res.setHeader('Set-Cookie', buildClearedSessionCookie(req, website))
      }
      res.writeHead(302, { Location: '/' })
      res.end()
    }
    if (!sid || !sessionsTbl || !website.db?.drizzle) {
      finish()
      return
    }
    website.db.drizzle
      .delete(sessionsTbl)
      .where(eq(sessionsTbl.sid, sid))
      .then(finish)
      .catch((err: unknown) => {
        console.error('logout delete session:', err)
        finish()
      })
  }

  private deleteSessionsForUser(website: Website, userId: number): Promise<void> {
    const sessionsTbl = website.db?.machines?.sessions?.table
    if (!sessionsTbl || !website.db?.drizzle) return Promise.resolve()
    return website.db.drizzle
      .delete(sessionsTbl)
      .where(eq(sessionsTbl.userId, userId))
      .then((): void => {})
  }

  private firstAdminExists(website: Website): Promise<boolean> {
    const usersTable = website.db.machines.users.table
    return website.db.drizzle
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, 'admin'))
      .then((rows) => rows.length > 0)
  }

  private forgotPasswordController(
    res: ServerResponse,
    req: IncomingMessage,
    website: Website,
    requestInfo: RequestInfo,
  ): void {
    const method = requestInfo.method
    if (method === 'GET') {
      sendAuthHtml(res, website, 'forgotPassword', {})
    } else if (method === 'POST') {
      parseForm(res, req).then((form) => {
        if (!requireDbConnection(res, website)) return
        if (!form.fields.email) {
          sendAuthHtml(res, website, 'forgotPassword', { error: 'Email is required' })
          return
        }

        const mailService = website.db!.machines.mail as MailService
        if (!mailService) {
          sendAuthHtml(res, website, 'forgotPassword', { error: 'Mail service not found' })
          return
        }

        const usersTable = website.db!.machines.users.table
        const db = website.db!.drizzle
        const email = String(form.fields.email).trim().toLowerCase()

        db.select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .then((rows) => {
            const user = rows[0] as User | undefined
            if (user) {
              const token = crypto.randomBytes(32).toString('hex')
              const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
              const protocol =
                (req.headers['x-forwarded-proto'] as string) || (website.env === 'production' ? 'https' : 'http')
              const resetUrl = `${protocol}://${requestInfo.host}/resetPassword?token=${token}`

              return db
                .update(usersTable)
                .set({
                  passwordResetToken: token,
                  passwordResetExpires: expires,
                })
                .where(eq(usersTable.id, user.id))
                .then(() => {
                  const partialTemplate = website.handlebars.partials['passwordResetEmail']
                  const html = partialTemplate
                    ? website.handlebars.compile(partialTemplate)({
                        resetUrl,
                        siteName: website.name,
                        email: user.email,
                      })
                    : `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`
                  const text = `Reset your password: ${resetUrl}`

                  mailService.sendEmail({
                    to: user.email,
                    subject: 'Reset your password',
                    text,
                    html,
                  })
                })
            }
          })
          .then(() => {
            sendAuthHtml(res, website, 'forgotPassword', {
              message:
                "If that email is registered, we've sent a link to reset your password. Check your inbox and spam folder.",
            })
          })
          .catch((err: unknown) => {
            console.error('forgotPassword error:', err)
            sendAuthHtml(res, website, 'forgotPassword', { error: 'Something went wrong. Please try again.' })
          })
      })
    } else {
      res.statusCode = 405
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Method not allowed')
    }
  }

  private resetPasswordController(
    res: ServerResponse,
    req: IncomingMessage,
    website: Website,
    requestInfo: RequestInfo,
  ): void {
    if (!requireDbConnection(res, website)) return

    const method = requestInfo.method
    const token = (requestInfo.query?.token as string) ?? ''
    const usersTable = website.db!.machines.users.table
    const db = website.db!.drizzle

    if (method === 'GET') {
      if (!token) {
        sendAuthHtml(res, website, 'resetPassword', {
          title: 'Reset Password',
          error: 'Invalid or expired reset link. Please request a new one.',
          forgotPasswordUrl: '/forgotPassword',
        })
        return
      }
      db.select()
        .from(usersTable)
        .where(and(eq(usersTable.passwordResetToken, token), gt(usersTable.passwordResetExpires, new Date())))
        .then((rows) => {
          if (rows.length === 0) {
            sendAuthHtml(res, website, 'resetPassword', {
              title: 'Reset Password',
              error: 'Invalid or expired reset link. Please request a new one.',
              forgotPasswordUrl: '/forgotPassword',
            })
            return
          }
          sendAuthHtml(res, website, 'resetPassword', { title: 'Reset Password', token })
        })
        .catch((err: unknown) => {
          console.error('resetPassword GET error:', err)
          sendAuthHtml(res, website, 'resetPassword', {
            title: 'Reset Password',
            error: 'Something went wrong. Please try again.',
            forgotPasswordUrl: '/forgotPassword',
          })
        })
      return
    }

    if (method === 'POST') {
      parseForm(res, req).then((form) => {
        const resetToken = (form.fields?.token ?? requestInfo.query?.token ?? '').toString().trim()
        const password = form.fields?.password ?? form.fields?.Password ?? ''
        const confirmPassword = form.fields?.confirmPassword ?? form.fields?.ConfirmPassword ?? ''

        if (!resetToken) {
          sendAuthHtml(res, website, 'resetPassword', {
            title: 'Reset Password',
            error: 'Invalid or expired reset link. Please request a new one.',
            forgotPasswordUrl: '/forgotPassword',
          })
          return
        }
        if (!password || password.length < 6) {
          sendAuthHtml(res, website, 'resetPassword', {
            title: 'Reset Password',
            token: resetToken,
            error: 'Password must be at least 6 characters.',
          })
          return
        }
        if (password !== confirmPassword) {
          sendAuthHtml(res, website, 'resetPassword', {
            title: 'Reset Password',
            token: resetToken,
            error: 'Passwords do not match.',
          })
          return
        }

        db.select()
          .from(usersTable)
          .where(and(eq(usersTable.passwordResetToken, resetToken), gt(usersTable.passwordResetExpires, new Date())))
          .then((rows) => {
            const user = rows[0] as User | undefined
            if (!user || user.id == null) {
              sendAuthHtml(res, website, 'resetPassword', {
                title: 'Reset Password',
                error: 'Invalid or expired reset link. Please request a new one.',
                forgotPasswordUrl: '/forgotPassword',
              })
              return
            }
            const userId = user.id
            return ThaliaSecurity.hashPassword(password)
              .then((hashedPassword) =>
                db
                  .update(usersTable)
                  .set({
                    password: hashedPassword,
                    passwordResetToken: null,
                    passwordResetExpires: null,
                  })
                  .where(eq(usersTable.id, userId)),
              )
              .then(() => this.deleteSessionsForUser(website, userId))
              .then(() => {
                res.writeHead(302, { Location: '/logon?message=Password+reset.+You+can+log+in+now.' })
                res.end()
              })
          })
          .catch((err: unknown) => {
            console.error('resetPassword POST error:', err)
            sendAuthHtml(res, website, 'resetPassword', {
              title: 'Reset Password',
              error: 'Something went wrong. Please try again.',
              forgotPasswordUrl: '/forgotPassword',
            })
          })
      })
      return
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Method not allowed')
  }

  /**
   * First-run bootstrap only: when **no** `admin` user exists, show a form (GET) or create the first admin (POST).
   * After the first admin exists, all requests get a clear error and should use `/logon` or invitations.
   */
  private setupController(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void {
    const method = requestInfo.method

    if (method === 'GET') {
      if (!requireDbConnection(res, website)) return
      this.firstAdminExists(website)
        .then((exists) => {
          if (exists) {
            sendAuthHtml(res, website, 'setup', {
              error: 'An administrator account already exists. Sign in or use your usual admin tools.',
              setupClosed: true,
            })
            return
          }
          sendAuthHtml(res, website, 'setup', {})
        })
        .catch((err: unknown) => {
          console.error('setup GET:', err)
          sendAuthHtml(res, website, 'setup', { error: 'Could not verify setup state. Try again.' })
        })
      return
    }

    if (method === 'POST') {
      if (!requireDbConnection(res, website)) return

      const drizzle = website.db!.drizzle

      this.firstAdminExists(website)
        .then((exists) => {
          if (exists) {
            sendAuthHtml(res, website, 'setup', { error: 'Setup is no longer available.', setupClosed: true })
            return
          }
          return parseForm(res, req)
        })
        .then((form) => {
          if (form === undefined) return undefined
          const name = (form.fields?.Name ?? form.fields?.name ?? '').trim()
          const email = (form.fields?.Email ?? form.fields?.email ?? '').trim().toLowerCase()
          const password = form.fields?.Password ?? form.fields?.password ?? ''
          const confirm = form.fields?.ConfirmPassword ?? form.fields?.confirmPassword ?? ''
          if (!name || !email || !password) {
            sendAuthHtml(res, website, 'setup', { error: 'Name, email and password are required.' })
            return undefined
          }
          if (password.length < 8) {
            sendAuthHtml(res, website, 'setup', { error: 'Password must be at least 8 characters.' })
            return undefined
          }
          if (password !== confirm) {
            sendAuthHtml(res, website, 'setup', { error: 'Passwords do not match.' })
            return undefined
          }
          return ThaliaSecurity.hashPassword(password).then((hashedPassword) =>
            drizzle
              .insert(users)
              .values({
                name,
                email,
                password: hashedPassword,
                role: 'admin',
                locked: false,
                verified: true,
              })
              .$returningId(),
          )
        })
        .then((insertId) => {
          if (insertId === undefined) return
          res.writeHead(302, { Location: '/logon?message=Administrator+created.+You+can+sign+in+now.' })
          res.end()
        })
        .catch((err: unknown) => {
          console.error('setup POST:', err)
          sendAuthHtml(res, website, 'setup', {
            error: 'Could not create administrator. The email may already be in use.',
          })
        })
      return
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Method not allowed')
  }

  /**
   * Additional self-service sign-up (role `user`). First `admin` must be created via `/setup` unless you seed the DB.
   */
  private createNewUserController(
    res: ServerResponse,
    req: IncomingMessage,
    website: Website,
    _requestInfo: RequestInfo,
  ): void {
    if (req.method !== 'POST') {
      res.writeHead(302, { Location: '/newUser' })
      res.end()
      return
    }
    parseForm(res, req)
      .then((form) => {
        if (!requireDbConnection(res, website)) return undefined
        const name = (form.fields?.Name ?? '').trim()
        const email = (form.fields?.Email ?? '').trim().toLowerCase()
        const password = form.fields?.Password ?? ''
        if (!name || !email || !password) {
          sendAuthHtml(res, website, 'newUser', { error: 'Name, email and password are required.' })
          return undefined
        }
        if (password.length < 8) {
          sendAuthHtml(res, website, 'newUser', { error: 'Password must be at least 8 characters.' })
          return undefined
        }
        return ThaliaSecurity.hashPassword(password).then((hashedPassword) =>
          website
            .db!.drizzle.insert(users)
            .values({
              name,
              email,
              password: hashedPassword,
              role: 'user',
              locked: false,
              verified: false,
            })
            .$returningId(),
        )
      })
      .then((id) => {
        if (id === undefined) return
        if (id != null) {
          res.writeHead(302, { Location: '/logon' })
          res.end()
        } else {
          sendAuthHtml(res, website, 'newUser', { error: 'An error occurred. That email may already be in use.' })
        }
      })
      .catch((err) => {
        console.error('createNewUser error:', err)
        sendAuthHtml(res, website, 'newUser', {
          error:
            err instanceof Error && err.message.includes('parse')
              ? 'Invalid request.'
              : 'An error occurred. That email may already be in use.',
        })
      })
  }

  public securityConfig(): RawWebsiteConfig {
    const thaliaAuth = this.defaultThaliaAuthOptions()
    const signupEnabled = !thaliaAuth.disableSelfRegistration

    const logoutHandler = this.logoutController.bind(this)
    const coreControllers: Record<string, NestedControllerMap> = {
      users: UserMachine.controller.bind(UserMachine),
      sessions: SessionMachine.controller.bind(SessionMachine),
      audits: AuditMachine.controller.bind(AuditMachine),
      admin: (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
        sendAuthHtml(res, website, 'admin', {
          requestInfo,
          requestInfoJson: JSON.stringify(requestInfo, null, 2),
        })
      },
      setup: this.setupController.bind(this),
      mail: this.mailService.controller.bind(this.mailService),
      logon: this.logonController.bind(this),
      forgotPassword: this.forgotPasswordController.bind(this),
      resetPassword: this.resetPasswordController.bind(this),
      logout: logoutHandler,
      logoff: logoutHandler,
    }

    if (signupEnabled) {
      coreControllers.newUser = (res: ServerResponse, req: IncomingMessage, website: Website): void => {
        sendAuthHtml(res, website, 'newUser', {})
      }
      coreControllers.createNewUser = this.createNewUserController.bind(this)
    }

    return {
      database: {
        schemas: {
          users,
          sessions,
          audits,
          mail: mailTable,
        },
        machines: {
          users: UserMachine,
          sessions: SessionMachine,
          audits: AuditMachine,
          mail: this.mailService,
          security: this,
        },
      },
      controllers: coreControllers as RawWebsiteConfig['controllers'],
      routes: default_routes,
      thaliaAuth,
    }
  }
}

export class SnipeSecurity extends ThaliaSecurity {}
