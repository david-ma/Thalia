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

import type { IncomingMessage, ServerResponse } from 'http'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { and, eq, gt } from 'drizzle-orm'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import type { NestedControllerMap, Website } from '../website.js'
import type { Machine, MachineReport } from '../controllers.js'
import { MailService, mailTable } from '../mail.js'
import { users, sessions, audits, authLoginThrottles, type User } from '../../models/security-models.js'
import type { RawWebsiteConfig, ThaliaAuthOptions } from '../types.js'
import { RequestInfo } from '../server.js'
import { parseForm } from '../util.js'
import { requireDbConnection, sendAuthHtml } from './auth-response-helpers.js'
import {
  buildClearedSessionCookie,
  buildSessionCookieValue,
  DEFAULT_THALIA_SESSION_MAX_AGE_SECONDS,
  sessionMaxAgeSecondsForWebsite,
} from './session-cookie.js'
import { default_routes } from './security-default-routes.js'
import { AuditMachine, SessionMachine, UserMachine } from './security-machines.js'
import {
  DUMMY_PASSWORD_HASH,
  authRateLimitMessage,
  checkAuthThrottleLimited,
  clearAuthThrottle,
  isRequestAuthenticated,
  isTemporarilyLocked,
  loginThrottleKeyHash,
  loginThrottleRepositoryForWebsite,
  normaliseLoginIdentity,
  recordAuthThrottleAttempt,
  type LoginThrottleRepository,
} from './login-throttle.js'

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
  private name = 'security'
  private readonly securityCtorOptions: ThaliaSecurityConstructorOptions

  constructor(options: ThaliaSecurityConstructorOptions = {}) {
    this.securityCtorOptions = options
    this.mailService = new MailService(options.mailAuthPath ?? '')
  }

  /** Defaults merged onto `Website.config.thaliaAuth` unless overridden in `config.ts`. */
  public defaultThaliaAuthOptions(): ThaliaAuthOptions {
    return {
      disableSelfRegistration: this.securityCtorOptions.disableSelfRegistration ?? false,
      disablePasswordReset: this.securityCtorOptions.disablePasswordReset ?? false,
      sessionMaxAgeSeconds: this.securityCtorOptions.sessionMaxAgeSeconds ?? DEFAULT_THALIA_SESSION_MAX_AGE_SECONDS,
    }
  }

  public async init(website: Website, name: string): Promise<MachineReport> {
    this.website = website
    this.name = name
    return this.health()
  }

  public async health(): Promise<MachineReport> {
    if (!this.website) {
      return { name: this.name, status: 'error', error: 'ThaliaSecurity not initialised' }
    }
    return { name: this.name, status: 'ok', detail: 'website wired' }
  }

  public controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void {
    console.debug('ThaliaSecurity controller')
  }

  public static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  public static verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  private logonController(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void {
    if (!requireDbConnection(res, website)) return

    const method = requestInfo.method
    if (method === 'GET') {
      const message = requestInfo.query?.message
      sendAuthHtml(
        res,
        website,
        'userLogin',
        message ? { message: typeof message === 'string' ? decodeURIComponent(message.replace(/\+/g, ' ')) : '' } : {},
      )
      return
    }
    if (method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Method not allowed')
      return
    }

    void this.handleLogonPost(res, req, website, requestInfo)
  }

  private async handleLogonPost(
    res: ServerResponse,
    req: IncomingMessage,
    website: Website,
    requestInfo: RequestInfo,
  ): Promise<void> {
    const drizzle = website.db!.drizzle
    const usersTable = website.db!.machines.users.table
    const throttleRepo: LoginThrottleRepository | null = loginThrottleRepositoryForWebsite(website)
    const throttleKey = loginThrottleKeyHash(String(requestInfo.ip ?? 'unknown-ip'))
    const attemptTime = new Date()
    const limitMsg = () =>
      authRateLimitMessage(isRequestAuthenticated(requestInfo), 'logon')

    try {
      const blocked = await checkAuthThrottleLimited(website, requestInfo, 'logon', attemptTime)
      if (blocked) {
        sendAuthHtml(res, website, 'userLogin', { error: blocked })
        return
      }

      const form = await parseForm(res, req)
      const email = normaliseLoginIdentity(form.fields.Email ?? form.fields.email ?? '')
      const password = form.fields.Password ?? form.fields.password ?? ''
      if (!email || !password) {
        sendAuthHtml(res, website, 'userLogin', { error: 'Email and password are required' })
        return
      }

      const rows = await drizzle.select().from(usersTable).where(eq(usersTable.email, email))
      const user = rows[0] as User | undefined
      const validPassword = await ThaliaSecurity.verifyPassword(password, user?.password ?? DUMMY_PASSWORD_HASH)

      if (!user || !validPassword) {
        let lockedNow = false
        if (throttleRepo) {
          try {
            const state = await throttleRepo.recordFailure(throttleKey, attemptTime)
            lockedNow = isTemporarilyLocked(state, attemptTime)
          } catch (err) {
            console.error('login throttle recordFailure failed:', err)
          }
        }
        sendAuthHtml(res, website, 'userLogin', {
          error: lockedNow ? limitMsg() : 'Invalid email or password',
        })
        return
      }

      if (user.locked) {
        sendAuthHtml(res, website, 'userLogin', { error: 'Account is locked' })
        return
      }

      await clearAuthThrottle(website, String(requestInfo.ip ?? 'unknown-ip'), 'logon')

      const sessionTable = website.db!.machines.sessions.table
      const sessionId = crypto.randomBytes(16).toString('hex')
      const maxAge = sessionMaxAgeSecondsForWebsite(website)
      const expiresAt = new Date(attemptTime.getTime() + maxAge * 1000)
      await drizzle.insert(sessionTable).values({
        sid: sessionId,
        userId: user.id,
        expires: expiresAt,
      })
      if (!res.headersSent) {
        res.setHeader('Set-Cookie', buildSessionCookieValue(sessionId, maxAge, req, website))
      }
      res.writeHead(302, { Location: '/' })
      res.end()
    } catch (error: unknown) {
      if (res.writableEnded) return
      console.error('Error logging in:', error)
      sendAuthHtml(res, website, 'userLogin', { error: 'An error occurred' })
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
      return
    }
    if (method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Method not allowed')
      return
    }

    void (async () => {
      if (!requireDbConnection(res, website)) return
      const blocked = await checkAuthThrottleLimited(website, requestInfo, 'forgotPassword')
      if (blocked) {
        sendAuthHtml(res, website, 'forgotPassword', { error: blocked })
        return
      }
      const limited = await recordAuthThrottleAttempt(website, requestInfo, 'forgotPassword')
      if (limited) {
        sendAuthHtml(res, website, 'forgotPassword', { error: limited })
        return
      }

      try {
        const form = await parseForm(res, req)
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

        const rows = await db.select().from(usersTable).where(eq(usersTable.email, email))
        const user = rows[0] as User | undefined
        if (user) {
          const token = crypto.randomBytes(32).toString('hex')
          const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
          const protocol =
            (req.headers['x-forwarded-proto'] as string) || (website.env === 'production' ? 'https' : 'http')
          const resetUrl = `${protocol}://${requestInfo.host}/resetPassword?token=${token}`

          await db
            .update(usersTable)
            .set({
              passwordResetToken: token,
              passwordResetExpires: expires,
            })
            .where(eq(usersTable.id, user.id))

          const partialTemplate = website.handlebars.partials['passwordResetEmail']
          const siteLabel = (website.name && String(website.name).trim()) || ''
          const preheader = siteLabel
            ? `${siteLabel} — use the link below to set a new password. Expires in 1 hour.`
            : 'Use the link below to set a new password. Expires in 1 hour.'
          const html = partialTemplate
            ? website.handlebars.compile(partialTemplate)({
                resetUrl,
                siteName: website.name,
                email: user.email,
                preheader,
              })
            : `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`
          const text = siteLabel
            ? `${siteLabel} — Reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`
            : `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`

          mailService.sendEmail({
            to: user.email,
            subject: 'Reset your password',
            text,
            html,
          })
        }

        sendAuthHtml(res, website, 'forgotPassword', {
          message:
            "If that email is registered, we've sent a link to reset your password. Check your inbox and spam folder.",
        })
      } catch (err: unknown) {
        console.error('forgotPassword error:', err)
        sendAuthHtml(res, website, 'forgotPassword', { error: 'Something went wrong. Please try again.' })
      }
    })()
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
      void (async () => {
        const blocked = await checkAuthThrottleLimited(website, requestInfo, 'resetPassword')
        if (blocked) {
          sendAuthHtml(res, website, 'resetPassword', {
            title: 'Reset Password',
            error: blocked,
            forgotPasswordUrl: '/forgotPassword',
          })
          return
        }
        const limited = await recordAuthThrottleAttempt(website, requestInfo, 'resetPassword')
        if (limited) {
          sendAuthHtml(res, website, 'resetPassword', {
            title: 'Reset Password',
            error: limited,
            forgotPasswordUrl: '/forgotPassword',
          })
          return
        }

        try {
          const form = await parseForm(res, req)
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

          const rows = await db
            .select()
            .from(usersTable)
            .where(and(eq(usersTable.passwordResetToken, resetToken), gt(usersTable.passwordResetExpires, new Date())))
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
          const hashedPassword = await ThaliaSecurity.hashPassword(password)
          await db
            .update(usersTable)
            .set({
              password: hashedPassword,
              passwordResetToken: null,
              passwordResetExpires: null,
            })
            .where(eq(usersTable.id, userId))
          await this.deleteSessionsForUser(website, userId)
          res.writeHead(302, { Location: '/logon?message=Password+reset.+You+can+log+in+now.' })
          res.end()
        } catch (err: unknown) {
          console.error('resetPassword POST error:', err)
          sendAuthHtml(res, website, 'resetPassword', {
            title: 'Reset Password',
            error: 'Something went wrong. Please try again.',
            forgotPasswordUrl: '/forgotPassword',
          })
        }
      })()
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

      void (async () => {
        const blocked = await checkAuthThrottleLimited(website, requestInfo, 'setup')
        if (blocked) {
          sendAuthHtml(res, website, 'setup', { error: blocked })
          return
        }
        const limited = await recordAuthThrottleAttempt(website, requestInfo, 'setup')
        if (limited) {
          sendAuthHtml(res, website, 'setup', { error: limited })
          return
        }

        const drizzle = website.db!.drizzle
        try {
          const exists = await this.firstAdminExists(website)
          if (exists) {
            sendAuthHtml(res, website, 'setup', { error: 'Setup is no longer available.', setupClosed: true })
            return
          }
          const form = await parseForm(res, req)
          const name = (form.fields?.Name ?? form.fields?.name ?? '').trim()
          const email = (form.fields?.Email ?? form.fields?.email ?? '').trim().toLowerCase()
          const password = form.fields?.Password ?? form.fields?.password ?? ''
          const confirm = form.fields?.ConfirmPassword ?? form.fields?.confirmPassword ?? ''
          if (!name || !email || !password) {
            sendAuthHtml(res, website, 'setup', { error: 'Name, email and password are required.' })
            return
          }
          if (password.length < 8) {
            sendAuthHtml(res, website, 'setup', { error: 'Password must be at least 8 characters.' })
            return
          }
          if (password !== confirm) {
            sendAuthHtml(res, website, 'setup', { error: 'Passwords do not match.' })
            return
          }
          await drizzle.insert(users).values({
            name,
            email,
            password: await ThaliaSecurity.hashPassword(password),
            role: 'admin',
            locked: false,
            verified: true,
          })
          res.writeHead(302, { Location: '/logon?message=Administrator+created.+You+can+sign+in+now.' })
          res.end()
        } catch (err: unknown) {
          console.error('setup POST:', err)
          sendAuthHtml(res, website, 'setup', {
            error: 'Could not create administrator. The email may already be in use.',
          })
        }
      })()
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
    requestInfo: RequestInfo,
  ): void {
    if (req.method !== 'POST') {
      res.writeHead(302, { Location: '/newUser' })
      res.end()
      return
    }

    void (async () => {
      if (!requireDbConnection(res, website)) return
      const blocked = await checkAuthThrottleLimited(website, requestInfo, 'createNewUser')
      if (blocked) {
        sendAuthHtml(res, website, 'newUser', { error: blocked })
        return
      }
      const limited = await recordAuthThrottleAttempt(website, requestInfo, 'createNewUser')
      if (limited) {
        sendAuthHtml(res, website, 'newUser', { error: limited })
        return
      }

      try {
        const form = await parseForm(res, req)
        const name = (form.fields?.Name ?? '').trim()
        const email = (form.fields?.Email ?? '').trim().toLowerCase()
        const password = form.fields?.Password ?? ''
        if (!name || !email || !password) {
          sendAuthHtml(res, website, 'newUser', { error: 'Name, email and password are required.' })
          return
        }
        if (password.length < 8) {
          sendAuthHtml(res, website, 'newUser', { error: 'Password must be at least 8 characters.' })
          return
        }
        const id = await website
          .db!.drizzle.insert(users)
          .values({
            name,
            email,
            password: await ThaliaSecurity.hashPassword(password),
            role: 'user',
            locked: false,
            verified: false,
          })
          .$returningId()
        if (id != null) {
          res.writeHead(302, { Location: '/logon' })
          res.end()
        } else {
          sendAuthHtml(res, website, 'newUser', { error: 'An error occurred. That email may already be in use.' })
        }
      } catch (err) {
        console.error('createNewUser error:', err)
        sendAuthHtml(res, website, 'newUser', {
          error:
            err instanceof Error && err.message.includes('parse')
              ? 'Invalid request.'
              : 'An error occurred. That email may already be in use.',
        })
      }
    })()
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
          authLoginThrottles,
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
