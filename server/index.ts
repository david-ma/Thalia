/**
 * index.ts - Main entry point for Thalia
 * 
 * This file serves as the main entry point for the Thalia framework.
 * 
 * Find the default project
 * Find out if we're running in standalone mode or multiplex mode
 * Find the port
 * 
 */

import { cwd } from 'process'
import { Server } from './server'
import { ServerOptions } from './types'
import { Website } from './website'
import path from 'path'

// Re-export types
export * from './types'
// Export main components
export {
  Server,
  Website
}

// Main Thalia class for easy initialization
export class Thalia {
  private server: Server
  private websites: Website[]

  constructor(options: ServerOptions) {
    this.websites = Website.loadAll(options)
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

const project = process.argv.find(arg => arg.startsWith('--project'))?.split('=')[1] || process.env['PROJECT'] || 'default'
const port = parseInt(process.argv.find(arg => arg.startsWith('--port'))?.split('=')[1] || process.env['PORT'] || '3000')

let options: ServerOptions = {
  mode: 'standalone',
  project: project,
  rootPath: cwd(),
  port: port
}

if (project == 'default') {
  console.log(`Running in multiplex mode. Loading all projects.`)
  options.mode = 'multiplex'
  options.rootPath = path.join(options.rootPath, 'websites')
} else {
  console.log(`Running in standalone mode for project: ${project}`)
  options.mode = 'standalone'
}

const thalia = new Thalia(options)

thalia.start()
