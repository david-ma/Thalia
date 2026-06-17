import { Server } from './server'
import { ServerOptions } from './types'
import { startupMark } from './startup-timer'

export interface Thalia {
  create(options: ServerOptions): Promise<Thalia>
  start(): Promise<void>
  stop(): Promise<void>
  getServer(): Server
}

import { Website } from './website'

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
      startupMark('thalia.load-websites.begin')
      const websites = await Website.loadAllWebsites(options)
      startupMark(`thalia.load-websites.done:${websites.length}`)
      // Filter out any websites that failed to load
      const validWebsites = websites.filter((website) => website !== null && website !== undefined)

      if (validWebsites.length === 0) {
        console.error('Error loading websites: No valid websites found')
        process.exit(1)
      }

      return new Thalia(options, validWebsites)
    } catch (error) {
      console.error('Error loading websites:', error)
      process.exit(1)
    }
  }

  public async start(): Promise<void> {
    await this.server.start()
  }

  public async stop(): Promise<void> {
    try {
      await this.server.stop()
    } finally {
      await Promise.all(this.websites.map((website) => website.closeDatabase()))
    }
  }

  public getServer(): Server {
    return this.server
  }
}
