import { IncomingMessage, ServerResponse } from 'http'
import http from 'http'
import { RouteRule } from './types'
import { Website } from './website'
import formidable from 'formidable'
import { RequestInfo } from './server'
import { RequestHandler } from './request-handler'
import { and, eq, gt, or, isNull } from 'drizzle-orm'

/**
 * True when `fullpath` is exactly this route key, or when it continues with another path segment
 * under that key. Avoids treating the root map key (`host/`) as a match for `host/fruit`, which
 * would otherwise require fragile "longest path first" ordering.
 */
export function routeFullpathMatchesMappedKey(fullpath: string, routeKey: string): boolean {
  return fullpath === routeKey || fullpath.startsWith(`${routeKey}/`)
}

/**
 * Paths that should be reachable without authentication, even when RoleRouteGuard is enabled.
 *
 * Route-guard runs before static-file serving, so pages like /logon must be able to load assets.
 * Prefix entries (e.g. "/css") match "/css/..." due to `routeFullpathMatchesMappedKey`.
 */
const ALWAYS_ALLOW_PATHS: string[] = [
  // robots + icons
  '/robots.txt',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',

  // common manifests / sitemaps
  '/sitemap.xml',
  '/manifest.json',
  '/site.webmanifest',

  // Security routes
  '/logon',
  '/logout',
  '/logoff',
  '/newUser',        // view — omitted from this list when `thaliaAuth.disableSelfRegistration`
  '/createNewUser',  // controller — omitted when `thaliaAuth.disableSelfRegistration`
  '/forgotPassword', // view
  '/resetPassword',  // controller
  '/setup', // first bootstrap (GET/POST until an admin exists)

  // static asset prefixes
  '/css',
  '/js',
  '/images',
  '/img',
  '/fonts',
  '/assets',
]
const ALWAYS_ALLOW_PERMISSIONS: Record<Role, Permission[]> = {
  guest: ['read'],
  user: ['read'],
  admin: ['read'],
}

function normalizeRoutePath(p: string | undefined | null): string {
  const raw = (p ?? '').trim()
  if (!raw) return '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  if (withSlash.length > 1) return withSlash.replace(/\/+$/, '')
  return '/'
}

/**
 * The RouteGuard class provides an alternative "handleRequest" method, which checks for an authentication cookie.
 * If the cookie is present, the request is allowed to proceed.
 * If there is no cookie or the cookie is incorrect, the request is redirected to the login page.
 *
 * Routeguard also provides a logoff
 *
 * RouteGuard currently takes in a very simple password.
 * We want to enable slightly more complex authentication methods.
 * User IDs, passwords, and roles. And session tracking.
 *
 *
 * This is the basic route guard.
 */
export class RouteGuard {
  protected website: Website
  constructor(website: Website) {
    this.website = website
  }

  /**
   * Promised based request handler, so we can chain multiple handlers together.
   *
   */
  public handleRequestChain(request: RequestHandler): Promise<RequestHandler> {
    return Promise.resolve(request)
  }
}

export class BasicRouteGuard extends RouteGuard {
  private routes: Record<string, RouteRule> = {}
  protected salt: number = 0
  protected routeRule!: RouteRule
  protected website: Website

  constructor(website: Website) {
    super(website)
    this.website = website
    this.salt = Math.floor(Math.random() * 999)
    this.loadRoutes()
  }

  protected getMatchingRoute(request: RequestHandler): RouteRule {
    const requestInfo = request.requestInfo
    const host = requestInfo.host
    // Use the original request pathname for route-guard decisions.
    // RequestHandler internally re-enters the handler chain for directory -> index.html resolution,
    // and `request.pathname` may be an override like "/index.html". Permissions should be based on
    // the user-facing path (e.g. "/"), not the internal lookup path.
    const pathname = requestInfo.pathname ?? ''
    const fullpath = host + (pathname === '' ? '/' : pathname)

    let best: [string, RouteRule] | undefined
    for (const [routeKey, rule] of Object.entries(this.routes)) {
      if (!routeFullpathMatchesMappedKey(fullpath, routeKey)) continue
      if (!best || routeKey.length > best[0].length) {
        best = [routeKey, rule]
      }
    }
    const rule = best?.[1] ?? {}
    if (Object.keys(rule).length === 0) {
      console.debug(
        `[route-guard] No matching route: host=${JSON.stringify(host)} pathname=${JSON.stringify(pathname)} fullpath=${JSON.stringify(fullpath)}`
      )
    } else {
      console.debug(
        `[route-guard] Matched route: fullpath=${JSON.stringify(fullpath)} -> path=${(rule as RouteRule).path}`
      )
    }
    return rule
  }

  public handleRequestChain(request: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      const routeRule = this.getMatchingRoute(request)
      if (Object.keys(routeRule).length === 0) {
        return next(request)
      }
      this.routeRule = routeRule

      if (routeRule.password) {
        const correctPassword = this.saltPassword(routeRule.password)
        const cookies = request.requestInfo.cookies
        const cookieName = `auth_${this.website.name}${routeRule.path}`

        if (request.pathname.startsWith(`${routeRule.path}/logoff`)) {
          request.res.setHeader('Set-Cookie', `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`)
          request.res.writeHead(302, { Location: '/' })
          request.res.end()
          return finish('Logged out')
        }

        if (cookies[cookieName] === correctPassword) {
          if (routeRule.proxyTarget) {
            this.handleProxy(request.req, request.res, routeRule)
            return finish('Proxy request')
          } else {
            return next(request)
          }
        }

        if (request.req.method === 'POST') {
          const form = formidable({ multiples: false })
          form.parse(request.req, (err, fields) => {
            if (err) {
              return finish('Error parsing form data')
            }

            const password = this.saltPassword(fields?.['password']?.[0] ?? '')
            if (password === correctPassword) {
              request.res.setHeader('Set-Cookie', `${cookieName}=${password}; Path=/`)
              request.res.writeHead(302, { Location: request.pathname })
              request.res.end()
              return finish('Logged in')
            } else {
              const login_html = this.website.handlebars.compile(this.website.handlebars.partials['login'])({
                route: request.pathname,
                message: 'Invalid password',
              })
              request.res.writeHead(401, { 'Content-Type': 'text/html' })
              request.res.end(login_html)
              return finish('Invalid password')
            }
          })
          return
        } else {
          const login_html = this.website.handlebars.compile(this.website.handlebars.partials['login'])({
            route: request.pathname,
          })
          request.res.writeHead(401, { 'Content-Type': 'text/html' })
          request.res.end(login_html)
          return finish('Login page')
        }
      } else if (routeRule.proxyTarget) {
        this.handleProxy(request.req, request.res, routeRule)
        return finish('Proxy request')
      } else {
        console.debug('No route rule password found')
        console.debug('Route rule', routeRule)
        return next(request)
      }
    })
  }

  private handleProxy(req: IncomingMessage, res: ServerResponse, route: RouteRule): void {
    if (!route.proxyTarget) return

    const options = {
      hostname: route.proxyTarget.host || 'localhost',
      port: route.proxyTarget.port || 80,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: route.proxyTarget.host || 'localhost',
      },
    }

    // Handle WebSocket and other upgrades
    if (req.headers.upgrade) {
      const proxyReq = http.request(options)
      proxyReq.on('upgrade', (proxyRes, proxySocket, _proxyHead) => {
        res.writeHead(proxyRes.statusCode || 101, proxyRes.headers)
        const clientSocket = res.socket
        if (clientSocket) {
          proxySocket.pipe(clientSocket)
          clientSocket.pipe(proxySocket)
        }
      })

      proxyReq.on('error', (error) => {
        console.error(`Proxy upgrade error for ${route.path}:`, error)
        // res.writeHead(500)
        res.end('Proxy Upgrade Error')
      })

      req.pipe(proxyReq)
      return
    }

    // Handle regular HTTP requests
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
      proxyRes.pipe(res)
    })

    proxyReq.on('error', (error) => {
      console.error(`Proxy error for ${route.path}:`, error)
      res.writeHead(500)
      res.end('Proxy Error')
    })

    req.pipe(proxyReq)
  }

  private loadRoutes() {
    // These should be reachable without login even when RoleRouteGuard is enabled.
    // If they match a route but have no permissions, the RoleRouteGuard will 401.
    const stripRegistration =
      this.website.config.thaliaAuth?.disableSelfRegistration === true
    const allowPaths = stripRegistration
      ? ALWAYS_ALLOW_PATHS.filter((p) => p !== '/newUser' && p !== '/createNewUser')
      : ALWAYS_ALLOW_PATHS

    const baseRoutes: RouteRule[] = allowPaths.map((p) => ({
      path: p,
      permissions: ALWAYS_ALLOW_PERMISSIONS,
    }))
    let siteRoutes = this.website.config.routes || []
    if (stripRegistration) {
      siteRoutes = siteRoutes.filter((r) => {
        const p = normalizeRoutePath(r.path)
        return p !== '/newUser' && p !== '/createNewUser'
      })
    }
    const routes = baseRoutes.concat(siteRoutes)
    routes.forEach((route) => {
      // Ensure required fields
      route.path = normalizeRoutePath(route.path)

      const domains = route.domains || this.website.domains

      // Add route for each domain
      domains.forEach((domain) => {
        this.routes[domain + route.path] = route
      })
    })
  }

  private saltPassword(password: string): string {
    const buff = Buffer.from(password + this.salt)
    return encodeURIComponent(buff.toString('base64'))
  }

  // private getMatchingRoute(host: string, pathname: string): RouteRule {
  //   return Object.entries(this.routes).find(([key]) => pathname.startsWith(key.replace(host, '')))?.[1] ?? {}
  // }

  public handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    website: Website,
    requestInfo: RequestInfo,
    pathnameOverride?: string,
  ): boolean {
    // const domain = requestInfo.domain
    const host = requestInfo.host
    const pathname = pathnameOverride ?? requestInfo.pathname
    // console.debug('route-guard on:', pathname)

    const ri =
      pathnameOverride !== undefined ? { ...requestInfo, pathname: pathnameOverride ?? requestInfo.pathname } : requestInfo
    const matchingRoute = this.getMatchingRoute({
      website: this.website,
      req,
      res,
      requestInfo: ri,
      pathname: pathnameOverride ?? requestInfo.pathname,
    } as unknown as RequestHandler)
    // const matchingRoute = this.getMatchingRoute(host, pathname)

    if (Object.keys(matchingRoute).length > 0) {
      // Check security if required
      if (matchingRoute?.password) {
        const correctPassword = this.saltPassword(matchingRoute.password)
        const cookies = requestInfo.cookies
        const cookieName = `auth_${website.name}${matchingRoute.path}`

        if (pathname === `${matchingRoute.path}/logoff`) {
          res.setHeader('Set-Cookie', `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`)
          res.writeHead(302, { Location: '/' })
          res.end()
          return true
        } else if (cookies[cookieName] === correctPassword) {
          // console.debug("We have the right password in our cookies")
          // Let them through
        } else if (req.method === 'POST') {
          // Check if they're posting
          try {
            const form = formidable({ multiples: false })
            form.parse(req, (err, fields) => {
              if (err) {
                console.error('Error parsing form data:', err)
                res.writeHead(400, { 'Content-Type': 'text/html' })
                res.end('Invalid form data')
                return true
              }

              const password = this.saltPassword(fields?.['password']?.[0] ?? '')

              if (password === correctPassword) {
                res.setHeader('Set-Cookie', `${cookieName}=${password}; Path=/`)
                res.writeHead(302, { Location: pathname })
                res.end()
                return true
              } else {
                const login_html = website.handlebars.compile(website.handlebars.partials['login'])({
                  route: pathname,
                  message: 'Invalid password',
                })
                res.writeHead(401, { 'Content-Type': 'text/html' })
                res.end(login_html)
                return true
              }
            })
            return true
          } catch (err) {
            console.error('Error parsing form data:', err)
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end('Invalid form data')
            return true
          }
        } else {
          // If the user doesn't have the login cookie, get the login page
          const login_html = website.handlebars.compile(website.handlebars.partials['login'])({
            route: pathname,
          })

          res.writeHead(401, { 'Content-Type': 'text/html' })
          res.end(login_html)
          return true // Request handled
        }
      }

      // Handle proxy if target is specified
      if (matchingRoute.proxyTarget) {
        this.handleProxy(req, res, matchingRoute)
        return true // Request handled
      }
      // website.handleRequest(req, res, requestInfo)
      return false
    }

    return false // Request not handled by guard
  }

  // protected setCookie(res: ServerResponse, name: string, value: string, path: string = '/') {
  //   res.setHeader('Set-Cookie', `${name}=${value}; Path=${path}`)
  // }

  // Moved to server.ts
  // protected parseCookies(req: IncomingMessage): Record<string, string> {
  //   const cookies: Record<string, string> = {}
  //   const cookieHeader = req.headers.cookie

  //   if (cookieHeader) {
  //     cookieHeader.split(';').forEach((cookie) => {
  //       const [name, value] = cookie.trim().split('=')
  //       if (name && value) {
  //         cookies[name] = value
  //       }
  //     })
  //   }

  //   return cookies
  // }
}

export type Role = 'admin' | 'user' | 'guest'
export type Permission = 'read' | 'update' | 'delete' | 'create' | 'manage'

import { RoleRouteRule } from './security'
import { CrudFactory } from './controllers'

export type SecurityConfig = {
  roles: Role[]
  routes: RouteRule[]
  // routes: RouteRule[] | RoleRouteRule[]
}

/**
 * If we have a database, we can use the security package.
 * This will allow webmasters to define roles and permissions for routes.
 * This also requires email, so that people can be invited, authenticated and reset their password.
 *
 */
export class RoleRouteGuard extends BasicRouteGuard {
  private roleRoutes: Record<string, RoleRouteRule> = {}

  constructor(website: Website) {
    super(website)
  }

  protected getMatchingRoute(request: RequestHandler): RoleRouteRule {
    return super.getMatchingRoute(request) as RoleRouteRule
  }

  public handleRequestChain(request: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      const routeRule = this.getMatchingRoute(request)
      // Match `BasicRouteGuard`: unknown host/path keys mean "not configured here" → pass through.
      if (Object.keys(routeRule).length === 0) {
        return next(request)
      }

      return this.getUserAuth(request.req, request.requestInfo)
        .then((userAuth) => {
          // Look up permissions for the user
          const permissions: Permission[] = routeRule.permissions?.[userAuth.role] ?? routeRule.permissions?.guest ?? []
          request.requestInfo.userAuth = userAuth
          request.requestInfo.permissions = permissions
          return request
        })
        .then((request) => {
          // If the user has the right permissions, let them through
          // Otherwise, send them to the login page
          const action = CrudFactory.getAction(request.requestInfo)
          if (request.requestInfo.permissions?.includes(action)) {
            return next(request)
          } else {
            if (request.requestInfo.userAuth?.role === 'guest') {
              console.debug(
                `[route-guard] 401 guest: host=${JSON.stringify(request.requestInfo.host)} pathname=${JSON.stringify(request.pathname)} action=${action} permissions=${JSON.stringify(request.requestInfo.permissions)} (no matching route or route has no guest permission for this action)`
              )
              // // please log in
              // const login_html = this.website.handlebars.compile(this.website.handlebars.partials['login'])({
              //   route: request.pathname,
              // })

              const login_html = this.website.getContentHtml('userLogin')({
                route: request.pathname,
              })

              // console.log('Sending Login page', login_html)
              request.res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' })
              request.res.end(login_html)
              return finish('User is not logged in, so we sent the login page')
            } else {
              console.debug(
                `[route-guard] 403: host=${JSON.stringify(request.requestInfo.host)} pathname=${JSON.stringify(request.pathname)} role=${request.requestInfo.userAuth?.role} action=${action}`
              )
              request.res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
              request.res.end('Access denied')
              return finish('Access denied')
            }
          }
        })
    })
  }

  private getUserAuth(req: IncomingMessage, requestInfo: RequestInfo): Promise<UserAuth> {
    const sessionId = requestInfo.cookies.sessionId
    // Must run before touching `db` — init failures set `website.db` to null.
    if (!this.website.db?.drizzle) {
      return Promise.resolve({ role: 'guest' })
    }

    const drizzle = this.website.db.drizzle
    const sessionsTbl = this.website.db.machines.sessions.table
    const users = this.website.db.machines.users.table

    if (!sessionId) {
      return Promise.resolve({ role: 'guest' })
    }

    type SessionJoinRow =
      | {
          sessions: { sid: string }
          users: { id: number; name: string; email: string; role: string; locked: boolean; verified: boolean } | null
        }
      | undefined

    return drizzle
      .select()
      .from(sessionsTbl)
      .leftJoin(users, eq(sessionsTbl.userId, users.id))
      .where(
        and(
          eq(sessionsTbl.sid, sessionId),
          eq(sessionsTbl.loggedOut, false),
          or(isNull(sessionsTbl.expires), gt(sessionsTbl.expires, new Date())),
        ),
      )
      .then((rows: unknown[]) => {
        const result = rows[0] as SessionJoinRow
        if (!result || !result.users || result.users.id == null) {
          return { role: 'guest' as const }
        }
        if (result.users.locked) {
          return { role: 'guest' as const }
        }
        return {
          userId: result.users.id,
          sessionId: result.sessions.sid,
          name: result.users.name,
          role: result.users.role as Role,
          email: result.users.email,
          locked: result.users.locked,
          verified: result.users.verified,
        }
      })
      .catch((err: unknown) => {
        console.error('Error getting user auth', err)
        return { role: 'guest' as const }
      })
  }
}

// Future:
// Enterprise route guard, with 3rd party authentication.
// BetterAuth?

export type UserAuth = {
  role: Role
  userId?: number
  sessionId?: string
  name?: string
  email?: string
  /** Present when authenticated; mirrored from `users.locked`. */
  locked?: boolean
  verified?: boolean
}
