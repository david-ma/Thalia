import { ServerResponse, IncomingMessage } from 'http'
import { Controller, Website } from './website.js'
import { CrudFactory, Machine } from './controllers.js'
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

import { MailService, mailTable } from './mail.js'

import { Permission, Role, SecurityConfig } from './route-guard.js'
export type { SecurityConfig }

import { users, sessions, audits } from '../models/security-models.js'
import { RawWebsiteConfig, RouteRule } from './types.js'

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

import { RequestInfo } from './server.js'
import { parseForm } from './controllers.js'
import { eq, Table } from 'drizzle-orm'
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
// import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'

import crypto from 'crypto'

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
    console.log('ThaliaSecurity controller')
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
      res.end(website.getContentHtml('userLogin')({}))
    } else if (method === 'POST') {
      parseForm(res, req).then((form) => {
        console.log('Login attempt:', form)
        if (!form.fields.Email || !form.fields.Password) {
          console.log('Email and password are required')
          res.end(website.getContentHtml('userLogin')({ error: 'Email and password are required' }))
          return
        }

        drizzle
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, form.fields.Email))
          .then(([user]) => {
            console.log('Found User', user)
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

              if (user.isActive === false) {
                res.end(website.getContentHtml('userLogin')({ error: 'Account is locked' }))
                return null
              }

              return user
            })
          })
          .then((user) => {
            if (!user) return

            console.log('We have a user', user)
            console.log('Generating a session')

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
              })
          })
          .catch((error) => {
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
      console.log('Headers already sent')
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
        console.log('We have a post!')
        console.log('Form', form)
        // Send an email to the user with a link to reset their password

        if (!form.fields.email) {
          res.end(website.getContentHtml('forgotPassword')({ error: 'Email is required' }))
          return
        }

        const mailService = website.db.machines.mail as MailService

        if (!mailService) {
          res.end(website.getContentHtml('forgotPassword')({ error: 'Mail service not found' }))
          return
        }
        console.log('Mail service', mailService)

        mailService.sendEmail({
          to: form.fields.email,
          subject: 'Reset your password',
          text: 'Reset your password',
          html: 'Reset your password',
        })

        const user = website.db.machines.users.table
        const drizzle = website.db.drizzle

        drizzle
          .select()
          .from(user)
          .where(eq(user.email, form.fields.email))
          .then(([user]) => {
            if (!user) {
              // Don't tell the user that the email is not found, just say it's been sent
              res.end(website.getContentHtml('forgotPassword')({ error: 'Email sent' }))
              return
            }

            // Send an email to the user with a link to reset their password
            // TODO: Implement this
            console.log('Sending email to', user.email)
            res.end(website.getContentHtml('forgotPassword')({ error: 'Email sent' }))
          })
      })
    } else {
      res.end('Method not allowed')
    }
  }

  private setupController(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void {
    const drizzle = website.db.drizzle
    const usersTable = website.db.machines.users.table

    drizzle
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, 'admin'))
      .then((users) => {
        console.log('Users', users)
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
          res.end(website.getContentHtml('admin')({ requestInfo }))
        },
        setup: this.setupController.bind(this),
        mail: this.mailService.controller.bind(this.mailService),
        logon: this.logonController.bind(this),
        forgotPassword: this.forgotPasswordController.bind(this),
        newUser: (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => {
          res.end(website.getContentHtml('newUser')({}))
        },
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
