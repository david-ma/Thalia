import { IncomingMessage, ServerResponse } from 'http'
import http from 'http'
import { RouteRule } from './types.js'
import { Website } from './website.js'
import formidable from 'formidable'
import { RequestInfo } from './server.js'
import { RequestHandler } from './request-handler.js'

/**
 * The RouteGuard class provides an alternative "handleRequest" method, which checks for an authentication cookie.
 * If the cookie is present, the request is allowed to proceed.
 * If there is no cookie or the cookie is incorrect, the request is redirected to the login page.
 *
 * Routeguard also provides a logout
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

  private getMatchingRoute(request: RequestHandler): RouteRule {
    const requestInfo = request.requestInfo
    const host = requestInfo.host
    const pathname = requestInfo.pathname

    return Object.entries(this.routes).find(([key]) => pathname.startsWith(key.replace(host, '')))?.[1] ?? {}
  }

  public handleRequestChain(request: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      if(request.website.env === 'development' && request.pathname.startsWith('/browser-sync/')) {
        return next(request)
      }

      const routeRule = this.getMatchingRoute(request)
      if (Object.keys(routeRule).length === 0) {
        return next(request)
      }
      this.routeRule = routeRule

      if (routeRule.password) {
        const correctPassword = this.saltPassword(routeRule.password)
        const cookies = this.parseCookies(request.req)
        const cookieName = `auth_${this.website.name}${routeRule.path}`
        
        if(request.pathname.startsWith(`${routeRule.path}/logout`)) {
          request.res.setHeader('Set-Cookie', `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`)
          request.res.writeHead(302, { Location: '/' })
          request.res.end()
          return finish("Logged out")
        }

        if (cookies[cookieName] === correctPassword) {
          return next(request)
        }

        if (request.req.method === 'POST') {
          const form = formidable({ multiples: false })
          form.parse(request.req, (err, fields) => {
            if (err) {
              return finish("Error parsing form data")
            }

            const password = this.saltPassword(fields?.['password']?.[0] ?? '')
            if (password === correctPassword) {
              request.res.setHeader('Set-Cookie', `${cookieName}=${password}; Path=/`)
              request.res.writeHead(302, { Location: request.pathname })
              request.res.end()
              return finish("Logged in")
            } else {
              const login_html = this.website.handlebars.compile(this.website.handlebars.partials['login'])({
                route: request.pathname,
                message: 'Invalid password',
              })
              request.res.writeHead(401, { 'Content-Type': 'text/html' })
              request.res.end(login_html)
              return finish("Invalid password")
            }
          })
          return finish("Form submitted")
        } else {
          const login_html = this.website.handlebars.compile(this.website.handlebars.partials['login'])({
            route: request.pathname,
          })
          request.res.writeHead(401, { 'Content-Type': 'text/html' })
          request.res.end(login_html)
          return finish("Login page")
        }

      } else if (routeRule.proxyTarget) {
        this.handleProxy(request.req, request.res, routeRule)
        return finish("Proxy request")
      } else {
        console.debug("No route rule found?")
        return next(request)
      }
    })
  }

  private handleProxy(req: IncomingMessage, res: ServerResponse, route: RouteRule): void {
    if (!route.proxyTarget) return

    const options = {
      hostname: route.proxyTarget.host,
      port: route.proxyTarget.port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: route.proxyTarget.host,
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
        res.writeHead(500)
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
    const routes = this.website.config.routes || []
    routes.forEach((route) => {
      // Ensure required fields
      if (!route.path) {
        route.path = '/'
      }

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

    const matchingRoute = this.getMatchingRoute(requestInfo)
    // const matchingRoute = this.getMatchingRoute(host, pathname)

    if (Object.keys(matchingRoute).length > 0) {
      // Check security if required
      if (matchingRoute?.password) {
        const correctPassword = this.saltPassword(matchingRoute.password)
        const cookies = this.parseCookies(req)
        const cookieName = `auth_${website.name}${matchingRoute.path}`

        // if developer mode, and browser-sync
        if (website.env === 'development' && pathname.startsWith('/browser-sync/')) {
          // let them through
          return false
        } else if (pathname === `${matchingRoute.path}/logout`) {
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

  protected parseCookies(req: IncomingMessage): Record<string, string> {
    const cookies: Record<string, string> = {}
    const cookieHeader = req.headers.cookie

    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie) => {
        const [name, value] = cookie.trim().split('=')
        if (name && value) {
          cookies[name] = value
        }
      })
    }

    return cookies
  }
}

type Role = 'admin' | 'user'
type Permission = 'view' | 'edit' | 'delete' | 'create'

type RoleRouteRule = {
  pattern: string
  permissions: {
    [key in Permission]?: Role[] | '*' // Which roles can perform this action
  }
  requireAuth?: boolean
  allowAnonymous?: boolean
  // For user-specific permissions
  ownerOnly?: Permission[] // Actions only the owner can perform
}

export type SecurityConfig = {
  roles: Role[]
  routes: RouteRule[]
}

/**
 * If we have a database, we can use the security package.
 * This will allow webmasters to define roles and permissions for routes.
 * This also requires email, so that people can be invited, authenticated and reset their password.
 *
 */
export class RoleRouteGaurd extends BasicRouteGuard {
  private roleRoutes: Record<string, RoleRouteRule> = {}

  constructor(website: Website) {
    console.log('RouteGaurdWithUsers', website.config.security)
    super(website)
  }

  public handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    website: Website,
    requestInfo: RequestInfo,
    pathnameOverride?: string,
  ): boolean {
    // Check security first
    const userAuth = this.getUserAuth(req) // Future: will be passed from handleRequest
    const canAccess = this.checkRouteAccess(requestInfo.url, userAuth)
    const pathname = pathnameOverride ?? requestInfo.pathname

    if (!canAccess) {
      res.writeHead(403, { 'Content-Type': 'text/html' })
      res.end('Access denied')
      return true
    }

    // If access granted, pass to controller
    // const controller = this.website.controllers[requestInfo.controller]
    // controller(res, req, website, requestInfo)
    // this.website.handleRequest(req, res, requestInfo, pathname)
    throw new Error('Not implemented')
    return true
  }

  private checkRouteAccess(url: string, userAuth: any): boolean {
    // Match URL against security patterns
    const routeRule = this.findMatchingRoute(url)
    if (!routeRule) return true // No rule = allow access

    return this.canPerformAction(userAuth, routeRule, 'view')
  }

  private findMatchingRoute(url: string): RoleRouteRule {
    return this.roleRoutes[url]
  }

  private getUserAuth(req: IncomingMessage): any {
    return {
      isAuthenticated: true,
      role: 'admin',
    }
  }

  private canPerformAction(
    userAuth: any,
    routeRule: RoleRouteRule,
    action: Permission,
    resourceOwner?: string,
  ): boolean {
    // Check if user is authenticated
    if (routeRule.requireAuth && !this.isAuthenticated(userAuth)) {
      return false
    }

    // Check if action is allowed for user's role
    const allowedRoles = routeRule.permissions[action]
    if (allowedRoles && allowedRoles !== '*' && !allowedRoles.includes(userAuth.role)) {
      return false
    }

    // Check owner-only permissions
    if (routeRule.ownerOnly?.includes(action)) {
      return userAuth.username === resourceOwner || userAuth.role === 'admin'
    }

    return true
  }

  private isAuthenticated(req: IncomingMessage): boolean {
    return true
  }

  private hasRole(userAuth: any, role: string): boolean {
    return true
  }

  private isLoggedIn(req: IncomingMessage): boolean {
    return true
  }
}

// Future:
// Enterprise route guard, with 3rd party authentication.
