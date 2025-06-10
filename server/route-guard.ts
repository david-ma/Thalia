import { IncomingMessage, ServerResponse } from 'http'
import http from 'http'
import { RouteRule } from './types'
import { Website } from './website'

export class RouteGuard {
  private routes: { [key: string]: RouteRule } = {}

  constructor(private website: Website) {
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

  public handleRequest(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname
    const host = req.headers.host || 'localhost'


    console.log("Pathname: ", pathname)
    console.log("Routes: ", this.routes)

    // Check for matching route
    // const routeKey = host + pathname
    const matchingRoute = Object.entries(this.routes).find(([key]) => 
      pathname.startsWith(key.replace(host, ''))
    )?.[1]

    if (matchingRoute) {
      // Check security if required
      if (matchingRoute.security?.password) {
        const cookies = this.parseCookies(req)
        const cookieName = `auth_${matchingRoute.path}`
        
        if (cookies[cookieName] !== matchingRoute.security.password) {
          res.writeHead(401, { 'Content-Type': 'text/html' })
          res.end(matchingRoute.security.message || 'Unauthorized')
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