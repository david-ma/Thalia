/**
 * Thalia - Main entry point
 * 
 * This file serves as the main entry point for the Thalia framework.
 * It exports all components and provides the main Thalia class for
 * server initialization.
 */

import { Server } from './core/server'
import { ServerOptions } from './core/types'

// Re-export types
export * from './core/types'

// Export main components
export {
  Server
}

// Main Thalia class for easy initialization
export class Thalia {
  private server: Server

  constructor(options: ServerOptions) {
    this.server = new Server(options)
  }

  public async start(): Promise<void> {
    await this.server.start()
  }

  public async stop(): Promise<void> {
    await this.server.stop()
  }

  public getServer(): Server {
    return this.server
  }
} 