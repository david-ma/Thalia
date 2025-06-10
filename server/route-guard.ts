import { IncomingMessage, ServerResponse } from 'http'
import http from 'http'
import { RouteRule } from './types'
import { Website } from './website'
import formidable from 'formidable'
import { URLSearchParams } from 'url'

export class RouteGuard {
  private routes: { [key: string]: RouteRule } = {}
  private salt: number = 0

  constructor(private website: Website) {
    this.salt = Math.floor(Math.random() * 999)
    this.loadRoutes()
  }

  private loadRoutes() {
    const routes = this.website.config.routes || []
    routes.forEach(route => {
      // Ensure required fields
      if (!route.path) {
        console.warn(`Route missing path in ${this.website.name}`)
        return
      }

      // Add route for each domain
      route.domains.forEach(domain => {
        this.routes[domain + route.path] = route
      })
    })
  }

  private saltPassword(password: string): string {
    const buff = Buffer.from(password + this.salt)
    return encodeURIComponent(buff.toString('base64'))
  }

  public handleRequest(req: IncomingMessage, res: ServerResponse, website: Website): boolean {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname
    const host = req.headers.host || 'localhost'

    const matchingRoute = Object.entries(this.routes).find(([key]) =>
      pathname.startsWith(key.replace(host, ''))
    )?.[1]

    if (matchingRoute) {
      // console.log("Found a matching route")

      // Check security if required
      if (matchingRoute?.password) {
        const correctPassword = this.saltPassword(matchingRoute.password)
        const cookies = this.parseCookies(req)
        const cookieName = `auth_${website.name}${matchingRoute.path}`

        // Check if they're posting
        if (req.method === 'POST') {
          console.log("We're posting")

          const form = formidable({ multiples: false })
          form.parse(req, (err, fields, files) => {

            if (err) {
              console.error('Error parsing form data:', err)
              res.writeHead(400, { 'Content-Type': 'text/html' })
              res.end('Invalid form data')
              return true
            }

            const password = this.saltPassword(fields?.['password']?.[0] ?? '')

            if (password === correctPassword) {
              res.setHeader('Set-Cookie', `${cookieName}=${password}; Path=/`)
              res.writeHead(302, { 'Location': pathname })
              res.end()
            } else {
              const login_html = website.handlebars.compile(website.handlebars.partials['login'])({
                route: matchingRoute.path,
                message: 'Invalid password'
              })
              res.writeHead(401, { 'Content-Type': 'text/html' })
              res.end(login_html)
            }
          })
          return true
        } else if (cookies[cookieName] === correctPassword) {
          // console.log("We have the right password in our cookies")
          // Let them through
        } else {
          // If the user doesn't have the login cookie, get the login page
          const login_html = website.handlebars.compile(website.handlebars.partials['login'])({
            route: matchingRoute.path
          })

          res.writeHead(401, { 'Content-Type': 'text/html' })
          res.end(login_html)
          return true // Request handled
        }
      }

      // Handle proxy if target is specified
      if (matchingRoute.target) {
        this.handleProxy(req, res, matchingRoute)
        return true // Request handled
      }
    }

    return false // Request not handled by guard
  }

  private handleProxy(req: IncomingMessage, res: ServerResponse, route: RouteRule): void {
    if (!route.target) return

    const options = {
      hostname: route.target.host,
      port: route.target.port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: route.target.host
      }
    }

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
      cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=')
        if (name && value) {
          cookies[name] = value
        }
      })
    }

    return cookies
  }
} 