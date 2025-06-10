/**
 * Thalia - Main entry point
 * 
 * This file serves as the main entry point for the Thalia framework.
 * It exports all components and provides the main Thalia class for
 * server initialization.
 */

import { ThaliaServer } from './server'
import { Website } from './core/website'
import { Router } from './core/router'
import { Handler } from './core/handler'
import { AuthHandler } from './core/auth'
import { ProxyHandler } from './core/proxy'
import { ServerOptions } from './core/types'
import { Thalia as ThaliaInterface } from './core/thalia'

// Re-export types
export * from './core/types'

// Export main components
export {
  ThaliaServer,
  Website,
  Router,
  Handler,
  AuthHandler,
  ProxyHandler
}

// Main Thalia class for easy initialization
export class Thalia implements ThaliaInterface {
  private server: ThaliaServer

  constructor(options: ServerOptions) {
    this.server = new ThaliaServer(options)
  }

  public async start(): Promise<void> {
    await this.server.start()
  }

  public async stop(): Promise<void> {
    await this.server.stop()
  }

  public getServer(): ThaliaServer {
    return this.server
  }
} 