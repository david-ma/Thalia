import { Server } from './server.js'
import { ServerOptions } from './types.js'

export interface Thalia {
  create(options: ServerOptions): Promise<Thalia>
  start(): Promise<void>
  stop(): Promise<void>
  getServer(): Server
}

import { Website } from './website.js'
// import { Database } from './database.js'
// import { RouteGuard } from './route-guard.js'


// Main Thalia class for easy initialization
export class Thalia {
  private server: Server
  private websites: Website[]

  private constructor(options: ServerOptions, websites: Website[]) {
    this.websites = websites
    this.server = new Server(options, this.websites)
  }

  // This should probably be called init
  public static async init(options: ServerOptions): Promise<Thalia> {
    try {
      const websites = await Website.loadAllWebsites(options)
      return new Thalia(options, websites)
    } catch (error) {
      console.error('Error loading websites:', error)
      process.exit(1)
    }
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