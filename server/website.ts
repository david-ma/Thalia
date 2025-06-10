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

import { Website as IWebsite, WebsiteConfig, ServerOptions } from './types'
import fs from 'fs'
import path from 'path'

export class Website implements IWebsite {
  public readonly name: string
  public readonly config: WebsiteConfig
  public readonly rootPath: string

  /**
   * Creates a new Website instance
   * @param config - The website configuration
   */
  constructor(config: WebsiteConfig) {
    this.name = config.name
    this.config = config
    this.rootPath = config.rootPath
  }

  /**
   * Loads a website from its configuration
   * @param config - The website configuration
   * @returns Promise resolving to a new Website instance
   */
  public static async load(config: WebsiteConfig): Promise<Website> {
    return new Website(config)
  }


  public static async loadAll(options: ServerOptions): Promise<Website[]> {
    if (options.mode == 'multiplex') {
      // Check if the root path exists
      // Load all websites from the root path
      const websites = await fs.readdirSync('websites')
      return websites.map(website => new Website({
        name: website,
        rootPath: path.join(options.rootPath, website)
      }))
    }

    return [new Website({
      name: options.project,
      rootPath: "Rootpath"
    })]
  }

} 