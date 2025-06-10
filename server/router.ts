/**
 * Router - Request routing implementation
 * 
 * The router is responsible for:
 * 1. Managing route definitions
 * 2. Matching incoming requests to routes
 * 3. Handling route parameters
 * 4. Executing route handlers
 * 
 * The router:
 * - Maintains a collection of routes
 * - Matches URLs to route patterns
 * - Extracts parameters from URLs
 * - Calls appropriate handlers
 * 
 * It does NOT handle:
 * - HTTP server setup (handled by Server)
 * - Request processing (handled by Handler)
 * - Authentication (handled by AuthHandler)
 */

import { IncomingMessage, ServerResponse } from 'http'
import { Thalia, Route, RouteHandler } from './types'

export class Router {
  private routes: Map<string, Route>
  private paramRoutes: Map<string, Route>

  constructor() {
    this.routes = new Map()
    this.paramRoutes = new Map()
  }

  /**
   * Adds a new route to the router
   * @param route - The route to add
   */
  public addRoute(route: Route): void {
    const key = `${route.method}:${route.path}`
    
    // Check if route has parameters
    if (route.path.includes(':')) {
      this.paramRoutes.set(key, route)
    } else {
      this.routes.set(key, route)
    }
  }

  /**
   * Handles an incoming request by matching it to a route
   * @param req - The incoming request
   * @param res - The server response
   */
  public async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method || 'GET'
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const path = url.pathname

    // Try exact match first
    const exactKey = `${method}:${path}`
    const exactRoute = this.routes.get(exactKey)
    
    if (exactRoute) {
      await exactRoute.handler(req, res, {})
      return
    }

    // Try parameter routes
    for (const [key, route] of this.paramRoutes) {
      const [routeMethod, routePath] = key.split(':')
      
      if (routeMethod !== method) continue

      const params = this.matchRoute(routePath, path)
      if (params) {
        await route.handler(req, res, params)
        return
      }
    }

    // No route found
    res.writeHead(404)
    res.end('Not Found')
  }

  /**
   * Matches a request path against a route pattern and extracts parameters
   * @param routePath - The route pattern to match against
   * @param requestPath - The actual request path
   * @returns Object containing extracted parameters or null if no match
   */
  private matchRoute(routePath: string, requestPath: string): Record<string, string> | null {
    const routeParts = routePath.split('/')
    const requestParts = requestPath.split('/')

    if (routeParts.length !== requestParts.length) {
      return null
    }

    const params: Record<string, string> = {}

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i]
      const requestPart = requestParts[i]

      if (routePart.startsWith(':')) {
        const paramName = routePart.slice(1)
        params[paramName] = requestPart
      } else if (routePart !== requestPart) {
        return null
      }
    }

    return params
  }
} 