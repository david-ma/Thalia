import { Server } from './server.js'
import { ServerOptions } from './types.js'

export interface Thalia {
  start(): Promise<void>
  stop(): Promise<void>
  getServer(): Server
}

export interface ThaliaConstructor {
  new (options: ServerOptions): Thalia
}

import { Website } from './website.js'
// import { Database } from './database.js'
// import { RouteGuard } from './route-guard.js'


// Main Thalia class for easy initialization
export class Thalia {
  private server: Server
  private websites: Website[]

  constructor(options: ServerOptions) {
    this.websites = Website.loadAllWebsites(options)
    this.server = new Server(options, this.websites)
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