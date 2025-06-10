/**
 * Website - Website configuration and management
 * 
 * The Website class is responsible for:
 * 1. Managing website configuration
 * 2. Coordinating between Router and Handler
 * 3. Providing website-specific functionality
 * 4. Loading website resources
 * 
 * The Website:
 * - Holds website configuration
 * - Manages website-specific routes
 * - Coordinates request handling
 * - Provides website context
 * 
 * It does NOT handle:
 * - HTTP server setup (handled by Server)
 * - Request routing (handled by Router)
 * - Request processing (handled by Handler)
 */

import { Thalia, WebsiteConfig } from './types'
import { Router } from './router'
import { Handler } from './handler'

export class Website implements Thalia.Website {
  public readonly name: string
  public readonly config: WebsiteConfig
  public readonly rootPath: string
  public readonly router: Router
  public readonly handler: Handler

  /**
   * Creates a new Website instance
   * @param config - The website configuration
   */
  constructor(config: WebsiteConfig) {
    this.name = config.name
    this.config = config
    this.rootPath = config.rootPath
    this.router = new Router()
    this.handler = new Handler(this)

    // Set up routes from config
    if (config.routes) {
      config.routes.forEach(route => this.router.addRoute(route))
    }
  }

  /**
   * Loads a website from its configuration
   * @param config - The website configuration
   * @returns Promise resolving to a new Website instance
   */
  public static async load(config: WebsiteConfig): Promise<Website> {
    return new Website(config)
  }
} 