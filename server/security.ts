import { ServerResponse, IncomingMessage } from 'http'
import { Controller, Website } from './website'
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
import { RawWebsiteConfig, RouteRule } from './types'

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

const default_routes: RoleRouteRule[] = [
  {
    path: '/',
    permissions: {
      guest: ALL_PERMISSIONS,
    },
  },
  {
    path: '/admin',
    permissions: {
      admin: ALL_PERMISSIONS,
    },
  },
  {
    path: '/user',
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
import { parseForm } from './controllers'
import { and, eq, gt, Update, Table } from 'drizzle-orm'
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

export class ThaliaSecurity implements Machine {
  public table!: MySqlTableWithColumns<any>
  private mailService: MailService
  private website!: Website

  constructor(
    options: {
      mailAuthPath?: string
    } = {},
  ) {
    this.mailService = new MailService(options.mailAuthPath ?? '')
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
    const drizzle = website.db.drizzle
    const usersTable = website.db.machines.users.table

    const method = requestInfo.method
    if (method === 'GET') {
      const message = requestInfo.query?.message
      res.end(
        website.getContentHtml('userLogin')(
          message ? { message: typeof message === 'string' ? decodeURIComponent(message.replace(/\+/g, ' ')) : '' } : {},
        ),
      )
    } else if (method === 'POST') {
      parseForm(res, req).then((form) => {
        console.debug('Login attempt:', form)
        if (!form.fields.Email || !form.fields.Password) {
          console.debug('Email and password are required')
          res.end(website.getContentHtml('userLogin')({ error: 'Email and password are required' }))
          return
        }

        drizzle
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, form.fields.Email))
          .then(([user]: [User | undefined]) => {
            if (!user) {
              res.end(website.getContentHtml('userLogin')({ error: 'Invalid email or password' }))
              return
            }

            // Use static method to verify password
            return ThaliaSecurity.verifyPassword(form.fields.Password, user.password).then((isValidPassword) => {
              if (!isValidPassword) {
                res.end(website.getContentHtml('userLogin')({ error: 'Invalid email or password' }))
                return null
              }

              if (user.locked) {
                res.end(website.getContentHtml('userLogin')({ error: 'Account is locked' }))
                return null
              }

              return user
            })
          })
          .then((user: User | null) => {
            if (!user) return

            // Generate a session
            const session = website.db.machines.sessions.table
            const sessionId = crypto.randomBytes(16).toString('hex')
            return website.db.drizzle
              .insert(session)
              .values({
                sid: sessionId,
                userId: user.id,
              })
              .then(() => {
                this.setCookie(res, sessionId)
                // TODO: Redirect to homepage
                res.writeHead(302, { Location: '/' })
                res.end()
              })
          })
          .catch((error: unknown) => {
            console.error('Error logging in:', error)
            res.end(website.getContentHtml('userLogin')({ error: 'An error occurred' }))
          })
      })
    } else {
      res.end('Method not allowed')
    }
  }

  // private getUserFromSession(sessionId: string): Promise<User> {
  //   const session = this.website.db.machines.sessions.table
  //   const drizzle = this.website.db.drizzle
  //   const user = this.website.db.machines.users.table
  //   return drizzle.select().from(user).where(eq(session.sid, sessionId)).then(([user]) => user)
  // }

  private setCookie(res: ServerResponse, sessionId: string): void {
    if (res.headersSent) {
      console.debug('Headers already sent')
      return
    }
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Strict`)
  }

  private forgotPasswordController(
    res: ServerResponse,
    req: IncomingMessage,
    website: Website,
    requestInfo: RequestInfo,
  ): void {
    const method = requestInfo.method
    if (method === 'GET') {
      res.end(website.getContentHtml('forgotPassword')({}))
    } else if (method === 'POST') {
      parseForm(res, req).then((form) => {
        if (!form.fields.email) {
          res.end(website.getContentHtml('forgotPassword')({ error: 'Email is required' }))
          return
        }

        const mailService = website.db.machines.mail as MailService
        if (!mailService) {
          res.end(website.getContentHtml('forgotPassword')({ error: 'Mail service not found' }))
          return
        }

        const usersTable = website.db.machines.users.table
        const db = website.db.drizzle
        const email = String(form.fields.email).trim().toLowerCase()

        db.select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .then((rows: User[]) => {
            const user = rows[0]
            if (user) {
              const token = crypto.randomBytes(32).toString('hex')
              const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
              const protocol =
                (req.headers['x-forwarded-proto'] as string) ||
                (website.env === 'production' ? 'https' : 'http')
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
            // Always show the same message (no user enumeration)
            res.end(
              website.getContentHtml('forgotPassword')({
                message:
                  "If that email is registered, we've sent a link to reset your password. Check your inbox and spam folder.",
              }),
            )
          })
          .catch((err: unknown) => {
            console.error('forgotPassword error:', err)
            res.end(
              website.getContentHtml('forgotPassword')({ error: 'Something went wrong. Please try again.' }),
            )
          })
      })
    } else {
      res.end('Method not allowed')
    }
  }

  private resetPasswordController(
    res: ServerResponse,
    req: IncomingMessage,
    website: Website,
    requestInfo: RequestInfo,
  ): void {
    const method = requestInfo.method
    const token = (requestInfo.query?.token as string) ?? ''
    const usersTable = website.db.machines.users.table
    const db = website.db.drizzle

    if (method === 'GET') {
      if (!token) {
        res.end(
          website.getContentHtml('resetPassword')({
            title: 'Reset Password',
            error: 'Invalid or expired reset link. Please request a new one.',
            forgotPasswordUrl: '/forgotPassword',
          }),
        )
        return
      }
      db.select()
        .from(usersTable)
        .where(and(eq(usersTable.passwordResetToken, token), gt(usersTable.passwordResetExpires, new Date())))
        .then((rows: User[]) => {
          if (rows.length === 0) {
            res.end(
              website.getContentHtml('resetPassword')({
                title: 'Reset Password',
                error: 'Invalid or expired reset link. Please request a new one.',
                forgotPasswordUrl: '/forgotPassword',
              }),
            )
            return
          }
          res.end(website.getContentHtml('resetPassword')({ title: 'Reset Password', token }))
        })
        .catch((err: unknown) => {
          console.error('resetPassword GET error:', err)
          res.end(
            website.getContentHtml('resetPassword')({
              title: 'Reset Password',
              error: 'Something went wrong. Please try again.',
              forgotPasswordUrl: '/forgotPassword',
            }),
          )
        })
      return
    }

    if (method === 'POST') {
      parseForm(res, req).then((form) => {
        const resetToken = (form.fields?.token ?? requestInfo.query?.token ?? '').toString().trim()
        const password = form.fields?.password ?? form.fields?.Password ?? ''
        const confirmPassword = form.fields?.confirmPassword ?? form.fields?.ConfirmPassword ?? ''

        if (!resetToken) {
          res.end(
            website.getContentHtml('resetPassword')({
              title: 'Reset Password',
              error: 'Invalid or expired reset link. Please request a new one.',
              forgotPasswordUrl: '/forgotPassword',
            }),
          )
          return
        }
        if (!password || password.length < 6) {
          res.end(
            website.getContentHtml('resetPassword')({
              title: 'Reset Password',
              token: resetToken,
              error: 'Password must be at least 6 characters.',
            }),
          )
          return
        }
        if (password !== confirmPassword) {
          res.end(
            website.getContentHtml('resetPassword')({
              title: 'Reset Password',
              token: resetToken,
              error: 'Passwords do not match.',
            }),
          )
          return
        }

        db.select()
          .from(usersTable)
          .where(and(eq(usersTable.passwordResetToken, resetToken), gt(usersTable.passwordResetExpires, new Date())))
          .then((rows: User[]) => {
            const user = rows[0]
            if (!user) {
              res.end(
                website.getContentHtml('resetPassword')({
                  title: 'Reset Password',
                  error: 'Invalid or expired reset link. Please request a new one.',
                  forgotPasswordUrl: '/forgotPassword',
                }),
              )
              return
            }
            return ThaliaSecurity.hashPassword(password)
              .then((hashedPassword) =>
                db
                  .update(usersTable)
                  .set({
                    password: hashedPassword,
                    passwordResetToken: null,
                    passwordResetExpires: null,
                  })
                  .where(eq(usersTable.id, user.id)),
              )
              .then(() => {
                res.writeHead(302, { Location: '/logon?message=Password+reset.+You+can+log+in+now.' })
                res.end()
              })
          })
          .catch((err: unknown) => {
            console.error('resetPassword POST error:', err)
            res.end(
              website.getContentHtml('resetPassword')({
                title: 'Reset Password',
                error: 'Something went wrong. Please try again.',
                forgotPasswordUrl: '/forgotPassword',
              }),
            )
          })
      })
      return
    }

    res.end('Method not allowed')
  }

  private setupController(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void {
    const drizzle = website.db.drizzle
    const usersTable = website.db.machines.users.table

    drizzle
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, 'admin'))
      .then((users: User[]) => {
        console.debug('Users', users)
        // If an admin user exists, we don't need to set up.
        if (users.length > 0) {
          res.end(website.getContentHtml('setup')({ error: 'Admin user already exists' }))
          return
        }

        const html = website.getContentHtml('setup')({})
        res.end(html)
      })

    // drizzle.insert(usersTable).values({
    //   email: 'admin@example.com',
    //   password: 'password',
    //   name: 'Admin',
    // })

    // console.log('Setup controller')
  }

  private createNewUserController(res: ServerResponse, req: IncomingMessage, website: Website, _requestInfo: RequestInfo): void {
    if (req.method !== 'POST') {
      res.writeHead(302, { Location: '/newUser' })
      res.end()
      return
    }
    parseForm(res, req).then((form) => {
      const name = (form.fields?.Name ?? '').trim()
      const email = (form.fields?.Email ?? '').trim().toLowerCase()
      const password = form.fields?.Password ?? ''
      if (!name || !email || !password) {
        res.end(website.getContentHtml('newUser')({ error: 'Name, email and password are required.' }))
        return
      }
      if (password.length < 6) {
        res.end(website.getContentHtml('newUser')({ error: 'Password must be at least 6 characters.' }))
        return
      }
      ThaliaSecurity.hashPassword(password).then((hashedPassword) => {
        return website.db.drizzle
          .insert(users)
          .values({
            name,
            email,
            password: hashedPassword,
            // role: 'user',
            role: 'admin', // Just for the mistral hackathon, 2026-03-01
            locked: false,
            verified: false,
          })
          .$returningId()
      })
        .then((id) => {
          if (id != null) {
            res.writeHead(302, { Location: '/logon' })
            res.end()
          } else {
            res.end(website.getContentHtml('newUser')({ error: 'An error occurred. That email may already be in use.' }))
          }
        })
        .catch((err) => {
          console.error('createNewUser error:', err)
          res.end(website.getContentHtml('newUser')({ error: 'An error occurred. That email may already be in use.' }))
        })
    }).catch(() => {
      res.end(website.getContentHtml('newUser')({ error: 'Invalid request.' }))
    })
  }

  public securityConfig(): RawWebsiteConfig {
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
      controllers: {
        users: UserMachine.controller.bind(UserMachine),
        sessions: SessionMachine.controller.bind(SessionMachine),
        audits: AuditMachine.controller.bind(AuditMachine),
        admin: (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
          res.end(
            website.getContentHtml('admin')({
              requestInfo: requestInfo,
              requestInfoJson: JSON.stringify(requestInfo, null, 2),
            }),
          )
        },
        setup: this.setupController.bind(this),
        mail: this.mailService.controller.bind(this.mailService),
        logon: this.logonController.bind(this),
        forgotPassword: this.forgotPasswordController.bind(this),
        resetPassword: this.resetPasswordController.bind(this),
        newUser: (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
          res.end(website.getContentHtml('newUser')({}))
        },
        createNewUser: this.createNewUserController.bind(this),
        logout: (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
          // set cookie to expire in 1970
          res.setHeader(
            'Set-Cookie',
            `sessionId=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
          )
          // redirect to home /
          res.writeHead(302, { Location: '/' })
          res.end()
        },
      },
      routes: default_routes,
    }
  }
}

export class SnipeSecurity extends ThaliaSecurity {}
