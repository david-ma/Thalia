/**
 * Handler - Request processing implementation
 * 
 * The handler is responsible for:
 * 1. Processing incoming requests
 * 2. Managing authentication
 * 3. Handling proxies
 * 4. Coordinating between different components
 * 
 * The handler:
 * - Acts as middleware between the server and router
 * - Manages authentication state
 * - Handles proxy requests
 * - Coordinates request flow
 * 
 * It does NOT handle:
 * - HTTP server setup (handled by Server)
 * - Route matching (handled by Router)
 * - Website configuration (handled by Website)
 */

import { IncomingMessage, ServerResponse } from 'http'
import { Thalia, Website } from './types'
import { Router } from './router'

export class Handler {
  private router: Router
  private website: Website

  /**
   * Creates a new Handler instance
   * @param website - The website this handler is for
   */
  constructor(website: Website) {
    this.website = website
    this.router = new Router()

    // Set up routes from website config
    if (website.config.routes) {
      website.config.routes.forEach(route => this.router.addRoute(route))
    }
  }

  /**
   * Processes an incoming request
   * @param req - The incoming request
   * @param res - The server response
   */
  public async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      // Check authentication if enabled
      if (this.website.config.auth?.enabled) {
        const sessionId = this.authHandler.getSessionFromCookie(req)
        if (!sessionId) {
          if (req.url !== this.website.config.auth.loginPath) {
            res.writeHead(302, { Location: this.website.config.auth.loginPath || '/login' })
            res.end()
            return
          }
        } else {
          const user = await this.authHandler.validateSession(sessionId)
          if (!user) {
            res.writeHead(302, { Location: this.website.config.auth.loginPath || '/login' })
            res.end()
            return
          }
        }
      }

      // Check for proxy
      const host = req.headers.host
      if (host) {
        const proxy = this.proxyHandler.getProxyForHost(host)
        if (proxy) {
          const middleware = this.proxyHandler.createProxyMiddleware(proxy)
          middleware(req, res, () => {})
          return
        }
      }

      // Handle with router
      await this.router.handle(req, res)
    } catch (error) {
      console.error('Error handling request:', error)
      res.writeHead(500)
      res.end('Internal Server Error')
    }
  }
} 