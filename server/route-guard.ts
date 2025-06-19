import { IncomingMessage, ServerResponse } from 'http'
import http from 'http'
import { RouteRule } from './types.js'
import { Website } from './website.js'
import formidable from 'formidable'
import { RequestInfo } from './server.js'

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
 *
 */
export class RouteGuard {
  private routes: Record<string, RouteRule> = {}
  private salt: number = 0

  constructor(private website: Website) {
    this.salt = Math.floor(Math.random() * 999)
    this.loadRoutes()
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

  private getMatchingRoute(host: string, pathname: string): RouteRule {
    return Object.entries(this.routes).find(([key]) => pathname.startsWith(key.replace(host, '')))?.[1] ?? {}
  }

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

    const matchingRoute = this.getMatchingRoute(host, pathname)

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

  private parseCookies(req: IncomingMessage): Record<string, string> {
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
